import { test, expect, type Page } from '@playwright/test';

/**
 * Regression suite for the explore homepage (unified map + filterable list).
 *
 * The map is MapLibre GL over a chain of interchangeable basemap providers
 * (MapTiler -> OpenFreeMap -> OpenStreetMap raster); only a browser without
 * WebGL, or every provider failing, drops it to a list-only view. Map
 * assertions therefore still check availability first. List, search, and
 * detail flows are asserted unconditionally — they must work everywhere.
 *
 * Mobile projects (Pixel 5 / iPhone 12, < 768px) default to a full-screen map
 * with a floating Map/List pill; the list pane is display-hidden until the
 * pill's List button is tapped. Helpers below normalize that difference.
 */
const PROVIDER_HOSTS: Record<string, string> = {
  maptiler: 'api.maptiler.com',
  openfreemap: 'tiles.openfreemap.org',
  osm: 'tile.openstreetmap.org',
};

/** The basemap tier the map is actually painting with. */
async function activeBasemap(page: Page): Promise<string | null> {
  return page.locator('[data-basemap]').first().getAttribute('data-basemap');
}

function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return viewport ? viewport.width < 768 : false;
}

async function gotoExplore(page: Page) {
  await page.goto('/');
  // The brand link renders server-side — proof the app shell is up.
  await expect(page.getByRole('link', { name: /NBIM Real Estate Map/ })).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * The map chunk is dynamically imported behind a skeleton, so availability
 * can only be decided by waiting: canvas attached => available; the wait
 * timing out => fallback (no WebGL) or genuinely broken map, which
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

  test('map initializes against the active basemap provider', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (request) => {
      // A GL style pulls everything (style JSON, tiles, glyphs, sprites) from
      // its provider — any request proves the wiring, so don't pattern-match
      // raster z/x/y paths that vector tiles won't have.
      try {
        hosts.add(new URL(request.url()).hostname);
      } catch {
        // Ignore malformed/non-standard request URLs.
      }
    });

    await gotoExplore(page);
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'map unavailable here (no WebGL) — list fallback covers it');

    const basemap = await activeBasemap(page);
    expect(Object.keys(PROVIDER_HOSTS)).toContain(basemap);

    const expectedHost = PROVIDER_HOSTS[basemap!];
    await expect
      .poll(() => [...hosts].some((host) => host.endsWith(expectedHost)), {
        message: `expected requests to ${expectedHost}, saw ${[...hosts].join(', ')}`,
        timeout: 15_000,
      })
      .toBe(true);
  });

  test('the map survives its primary basemap provider failing', async ({ page }) => {
    // The "MapTiler credits ran out" case: every request to the leading
    // provider is answered 402, exactly as an exhausted quota would be. The
    // map must switch itself to the next tier rather than disappear — with
    // the property markers and their interactions intact on the new style.
    await page.route('**://api.maptiler.com/**', (route) =>
      route.fulfill({ status: 402, contentType: 'text/plain', body: 'Payment Required' }),
    );

    await page.goto('/?q=79%20Avenue%20des%20Champs');
    await expect(page.getByRole('link', { name: /NBIM Real Estate Map/ })).toBeVisible({
      timeout: 30_000,
    });
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'no WebGL here — provider fallback is a map behaviour');

    // Whatever tier ends up painting, it must not be the blocked one, and the
    // map view toggle must still be offered (i.e. the app did not give up).
    await expect
      .poll(() => activeBasemap(page), { timeout: 20_000 })
      .not.toBe('maptiler');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();

    // Markers are re-added onto the swapped-in style: framing the single
    // result and clicking it must still peek the callout.
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
    await expect(page.locator('.maplibregl-popup').getByText('View details ›')).toBeVisible();
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
    await sheetSearch.fill('79 Avenue des Champs');

    // The apply button's live count narrows as the query applies.
    const apply = page.getByRole('button', { name: /^Show [\d,]+ propert(y|ies)$/ });
    await expect(apply).toContainText('Show 1 property');
    await apply.click();
    await expect(page.getByRole('heading', { name: 'Filters' })).toBeHidden();

    // Applying must FRAME the result — tapping map center hits that property.
    await page.waitForTimeout(2_500);
    const canvas = await page.locator('.maplibregl-canvas').boundingBox();
    await page.touchscreen.tap(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2);
    // Scope to the map popup — the hidden list pane also contains the name.
    const popup = page.locator('.maplibregl-popup');
    await expect(popup.getByText('View details ›')).toBeVisible();
    await expect(popup.getByText(/79 Avenue des Champs/)).toBeVisible();
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

  test('mobile map clear button removes the query without opening the sheet', async ({ page }) => {
    test.skip(!isMobileViewport(page), 'mobile-only surface');

    // Arrive with an active query (shared link) — the pill shows it.
    await page.goto('/?q=Paris');
    await expect(page.getByRole('link', { name: /NBIM Real Estate Map/ })).toBeVisible({
      timeout: 30_000,
    });
    const mapAvailable = await waitForMapAvailability(page);
    test.skip(!mapAvailable, 'the floating clear button only exists on the map surface');

    await expect(page.getByRole('button', { name: 'Paris' })).toBeVisible();

    // Exactly one ✕ (strict-mode locator throws on duplicates); tapping it
    // clears the query in place — the filter sheet must never open.
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByRole('heading', { name: 'Filters' })).toBeHidden();
    await expect(
      page.getByRole('button', { name: /Search & filter properties/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear search' })).toBeHidden();
    await expect(page).not.toHaveURL(/q=/);
  });
});
