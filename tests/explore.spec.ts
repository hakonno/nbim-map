import { test, expect, type Page } from '@playwright/test';

/**
 * Regression suite for the explore homepage (unified map + filterable list).
 *
 * The map is MapLibre GL fed by MapTiler; when WebGL or the API key is
 * unavailable the app intentionally falls back to a list-only view, so every
 * map assertion first checks availability instead of failing. List, search,
 * and detail flows are asserted unconditionally — they must work everywhere.
 *
 * Mobile projects (Pixel 5 / iPhone 12, < 768px) default to a full-screen map
 * with a floating Map/List pill; the list pane is display-hidden until the
 * pill's List button is tapped. Helpers below normalize that difference.
 */
const EXPECTED_TILE_HOST = 'api.maptiler.com';

function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return viewport ? viewport.width < 768 : false;
}

async function dismissDisclaimer(page: Page) {
  // First-visit disclaimer modal; its backdrop intercepts all interactions.
  const gotIt = page.getByRole('button', { name: 'Got it' });
  try {
    await gotIt.waitFor({ state: 'visible', timeout: 8_000 });
    await gotIt.click();
    await gotIt.waitFor({ state: 'hidden', timeout: 5_000 });
  } catch {
    /* modal not shown (already acknowledged) — nothing to dismiss */
  }
}

async function gotoExplore(page: Page) {
  await page.goto('/');
  // The brand link renders server-side — proof the app shell is up.
  await expect(page.getByRole('link', { name: /NBIM Real Estate Map/ })).toBeVisible({
    timeout: 30_000,
  });
  await dismissDisclaimer(page);
}

/**
 * The map chunk is dynamically imported behind a skeleton, so availability
 * can only be decided by waiting: canvas attached => available; the wait
 * timing out => fallback (no WebGL / no key) or genuinely broken map, which
 * dedicated tests cover. Never call this before deciding to skip.
 */
async function waitForMapAvailability(page: Page, timeoutMs = 20_000): Promise<boolean> {
  try {
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/** Mobile defaults to the map surface; the list must be summoned via the pill. */
async function ensureListVisible(page: Page) {
  if (!isMobileViewport(page)) return;
  const listButton = page.getByRole('button', { name: /^List\b/ });
  if (await listButton.isVisible().catch(() => false)) {
    await listButton.click();
  }
  // Either way (pill tap or list-only fallback) the search box must appear.
  await expect(page.getByLabel('Search properties')).toBeVisible({ timeout: 10_000 });
}

/** FilterBar's live result counter, e.g. "1,388 properties" / "94 of 1,388 properties". */
function resultSummary(page: Page) {
  return page
    .locator('[aria-live="polite"]')
    .filter({ hasText: /of|properties$/ })
    .last();
}

function parseCount(text: string): number {
  const match = text.match(/([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
}

test.describe('explore homepage', () => {
  test('loads without uncaught page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await gotoExplore(page);
    await ensureListVisible(page);

    const search = page.getByLabel('Search properties');
    await search.fill('London');
    await page.getByRole('button', { name: 'Clear search' }).click();

    // Give late async work (map load, tile errors) a moment to surface.
    await page.waitForTimeout(2_000);
    expect(errors, `uncaught errors:\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('map initializes with MapTiler as the data source', async ({ page }) => {
    const maptilerRequests: string[] = [];
    page.on('request', (request) => {
      // The GL style pulls everything (style JSON, vector tiles, glyphs,
      // sprites) from MapTiler — any request proves the wiring, so don't
      // pattern-match raster z/x/y paths that vector tiles won't have.
      if (new URL(request.url()).host.endsWith(EXPECTED_TILE_HOST)) {
        maptilerRequests.push(request.url());
      }
    });

    await gotoExplore(page);
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'map unavailable here (no WebGL or no key) — list fallback covers it');

    expect(
      maptilerRequests.length,
      `expected requests to ${EXPECTED_TILE_HOST}, saw none`,
    ).toBeGreaterThan(0);
  });

  test('search narrows the result count and clears back', async ({ page }) => {
    await gotoExplore(page);
    await ensureListVisible(page);

    const summary = resultSummary(page);
    await expect(summary).toBeVisible();
    const total = parseCount((await summary.textContent()) ?? '');
    expect(total).toBeGreaterThan(0);

    // A real portfolio city — must narrow to a non-empty strict subset.
    await page.getByLabel('Search properties').fill('Paris');
    await expect
      .poll(async () => parseCount((await summary.textContent()) ?? ''))
      .toBeLessThan(total);
    const narrowed = parseCount((await summary.textContent()) ?? '');
    expect(narrowed).toBeGreaterThan(0);
    await expect(
      page.getByRole('link', { name: /^View / }).first(),
    ).toHaveAccessibleName(/Paris/);

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect
      .poll(async () => parseCount((await summary.textContent()) ?? ''))
      .toBe(total);
  });

  test('card opens the detail panel at its real URL; closing goes back to /', async ({ page }) => {
    await gotoExplore(page);
    await ensureListVisible(page);

    // Cards are real anchors (crawlable); soft navigation intercepts into the panel.
    const firstCard = page.getByRole('link', { name: /^View / }).first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    await expect(page).toHaveURL(/\/property\/[^/]+$/);
    const detail = page.getByRole('dialog', { name: / details$/ });
    await expect(detail).toBeVisible();

    if (isMobileViewport(page)) {
      // Mobile sheet covers the results — dismiss goes back in history.
      await expect(detail.getByRole('button', { name: 'Back to results' })).toBeVisible();
      await detail.getByRole('button', { name: 'Back to results' }).click();
    } else {
      // Desktop always shows a plain Close; Escape matches it.
      await expect(detail.getByRole('button', { name: 'Close details' })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await expect(detail).toBeHidden();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });

  test('filters mirror into the URL and shared links apply', async ({ page }) => {
    await gotoExplore(page);
    await ensureListVisible(page);

    await page.getByLabel('Search properties').fill('Paris');
    await expect(page).toHaveURL(/\?q=Paris/);

    // A shared filter link narrows the result set after hydration.
    await page.goto('/?country=France');
    await ensureListVisible(page);
    const summary = resultSummary(page);
    await expect(summary).toContainText(/of/, { timeout: 10_000 });
  });

  test('property links on content pages open the app with the panel over it', async ({ page }) => {
    // Regression: reaching the intercepted route from OUTSIDE the explore page
    // must render the app via app/(explore)/default.tsx — previously the panel
    // floated over an empty page (no header, no map).
    test.slow();
    await page.goto('/properties');
    await dismissDisclaimer(page);
    const link = page.locator('a[href^="/property/"]').first();
    await expect(link).toBeVisible({ timeout: 60_000 });
    await link.click();

    await expect(page).toHaveURL(/\/property\/[^/]+$/);
    await expect(page.getByRole('dialog', { name: / details$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /NBIM Real Estate Map/ })).toBeVisible();
  });

  test('hard-loading a property URL renders the full page, not the panel', async ({ page }) => {
    // /properties renders all 1,388 links — the first dev-mode compile of the
    // page can exceed the default budget, so allow extra time.
    test.slow();
    await page.goto('/properties');
    // First property link in the directory index.
    const propertyLink = page.locator('a[href^="/property/"]').first();
    await expect(propertyLink).toBeVisible({ timeout: 60_000 });
    const href = await propertyLink.getAttribute('href');
    await page.goto(href!);
    await dismissDisclaimer(page);
    await expect(page.getByRole('button', { name: 'Back to results' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'All properties' }).first()).toBeVisible();
  });

  test('desktop view toggle switches list / split / map', async ({ page }) => {
    test.skip(isMobileViewport(page), 'desktop-only control');

    await gotoExplore(page);
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'view toggle only renders when the map is usable');

    const search = page.getByLabel('Search properties');

    await page.getByRole('button', { name: /^list$/i }).click();
    await expect(search).toBeVisible();
    await expect(page.locator('.maplibregl-canvas')).toBeHidden();

    await page.getByRole('button', { name: /^map$/i }).click();
    await expect(search).toBeHidden();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();

    await page.getByRole('button', { name: /^split$/i }).click();
    await expect(search).toBeVisible();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  });

  test('typing shows exactly one clear button (native ✕ suppressed)', async ({ page }) => {
    await gotoExplore(page);
    await ensureListVisible(page);

    const search = page.getByLabel('Search properties').first();
    await search.fill('London');
    // Exactly one custom clear control; the native WebKit cancel button is a
    // pseudo-element suppressed in globals.css (not queryable cross-engine).
    await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCount(1);
  });

  test('mobile map pill opens a sheet where search actually works', async ({ page }) => {
    test.skip(!isMobileViewport(page), 'mobile-only surface');

    await gotoExplore(page);
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'the floating filter pill only exists on the map surface');

    await page.getByRole('button', { name: /Search & filter properties/ }).click();
    // Scope to the sheet: the (hidden) list pane mounts its own search input.
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    const sheetSearch = sheet.getByLabel('Search properties');
    await expect(sheetSearch).toBeVisible();
    await sheetSearch.fill('Paris');

    // The apply button's live count narrows as the query applies.
    const apply = page.getByRole('button', { name: /^Show [\d,]+ propert(y|ies)$/ });
    await expect(apply).not.toContainText('1,388');
    await apply.click();
    await expect(page.getByRole('heading', { name: 'Filters' })).toBeHidden();
  });

  test('desktop map view: search pill drops into split with search focused', async ({ page }) => {
    test.skip(isMobileViewport(page), 'desktop-only control');

    await gotoExplore(page);
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'map view requires the map');

    await page.getByRole('button', { name: /^map$/i }).click();
    await expect(page.getByLabel('Search properties')).toBeHidden();

    await page.getByRole('button', { name: 'Search properties' }).click();
    await expect(page.getByRole('button', { name: /^split$/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Search properties')).toBeFocused();
  });

  test('marker click peeks (callout), callout click opens the panel', async ({ page }) => {
    // Narrow to a single property so the framed marker sits at map center.
    await page.goto('/?q=79%20Avenue%20des%20Champs');
    await dismissDisclaimer(page);
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'peek is a map interaction');

    await page.getByRole('button', { name: 'Frame all results' }).click();
    await page.waitForTimeout(2_000);

    const canvas = await page.locator('.maplibregl-canvas').boundingBox();
    const cx = canvas!.x + canvas!.width / 2;
    const cy = canvas!.y + canvas!.height / 2;
    if (isMobileViewport(page)) {
      await page.touchscreen.tap(cx, cy);
    } else {
      await page.mouse.click(cx, cy);
    }

    const callout = page.getByText('View details ›');
    await expect(callout).toBeVisible();
    await expect(page.getByRole('dialog', { name: / details$/ })).toHaveCount(0);
    await expect(page).toHaveURL(/\/\?q=/);

    await callout.click();
    await expect(page.getByRole('dialog', { name: / details$/ })).toBeVisible();
    await expect(page).toHaveURL(/\/property\/[^/]+$/);
  });

  test('mobile filter sheet opens from the map and applies', async ({ page }) => {
    test.skip(!isMobileViewport(page), 'mobile-only surface');

    await gotoExplore(page);
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'the floating filter pill only exists on the map surface');

    await page.getByRole('button', { name: /Search & filter properties/ }).click();
    await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();

    const apply = page.getByRole('button', { name: /^Show [\d,]+ properties$/ });
    await expect(apply).toBeVisible();
    await apply.click();
    await expect(page.getByRole('heading', { name: 'Filters' })).toBeHidden();
  });
});
