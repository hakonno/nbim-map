import { test, expect, type Page } from '@playwright/test';

/**
 * Regression suite for the city investment map.
 *
 * The functional tests (container renders, markers render, zoom works, no page
 * errors) are intentionally tile-source agnostic: they must stay green both
 * before and after the OpenStreetMap -> MapTiler migration, proving the swap
 * did not break map behaviour.
 *
 * `EXPECTED_TILE_HOST` is set to the MapTiler endpoint up front (TDD): it is RED
 * while the map still serves OSM tiles, and GREEN once the migration lands.
 */
const EXPECTED_TILE_HOST = 'api.maptiler.com';

// Matches the trailing `/{z}/{x}/{y}.png` (optionally `@2x`) of a slippy-map tile URL.
const TILE_ZXY = /\/(\d{1,2})\/\d{1,6}\/\d{1,6}(?:@2x)?\.(?:png|jpe?g|webp)(?:\?|$)/;

async function gotoMap(page: Page) {
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });

  // Dismiss the first-visit disclaimer modal so its full-screen backdrop does
  // not intercept map interactions (e.g. the zoom control). Clicking "Got it"
  // keeps the test decoupled from how the dismissal is persisted.
  const gotIt = page.getByRole('button', { name: 'Got it' });
  try {
    await gotIt.waitFor({ state: 'visible', timeout: 8_000 });
    await gotIt.click();
    await gotIt.waitFor({ state: 'hidden', timeout: 5_000 });
  } catch {
    /* modal not shown — nothing to dismiss */
  }
}

test.describe('city map', () => {
  test('renders the Leaflet map container', async ({ page }) => {
    await gotoMap(page);
    await expect(page.locator('.leaflet-container')).toBeVisible();
    // Pane structure confirms Leaflet initialised, not just an empty div.
    await expect(page.locator('.leaflet-tile-pane')).toBeAttached();
  });

  test('renders city markers/clusters after data loads', async ({ page }) => {
    await gotoMap(page);
    const markers = page.locator('.leaflet-marker-icon, .marker-cluster');
    await expect(markers.first()).toBeVisible({ timeout: 30_000 });
  });

  test('zoom-in control increases the requested tile zoom', async ({ page }) => {
    const requestedZoom: number[] = [];
    page.on('request', (req) => {
      const match = req.url().match(TILE_ZXY);
      if (match) requestedZoom.push(Number(match[1]));
    });

    await gotoMap(page);
    await page.waitForTimeout(1500);
    const before = Math.max(0, ...requestedZoom);

    const zoomIn = page.locator('.leaflet-control-zoom-in');
    await zoomIn.click();
    await zoomIn.click();
    await page.waitForTimeout(1500);
    const after = Math.max(0, ...requestedZoom);

    expect(after, 'zooming in should request higher-zoom tiles').toBeGreaterThan(before);
  });

  test('does not throw any uncaught page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoMap(page);
    await page.waitForTimeout(2000);
    expect(errors, `uncaught errors:\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('base map tiles are served by MapTiler', async ({ page }) => {
    const tileHosts = new Set<string>();
    page.on('request', (req) => {
      const url = req.url();
      if (TILE_ZXY.test(url)) {
        try {
          tileHosts.add(new URL(url).host);
        } catch {
          /* ignore unparseable urls */
        }
      }
    });

    await gotoMap(page);
    await page.waitForTimeout(2500);

    expect(
      [...tileHosts].some((host) => host.includes(EXPECTED_TILE_HOST)),
      `expected tiles from ${EXPECTED_TILE_HOST}, saw: ${[...tileHosts].join(', ') || '(none)'}`,
    ).toBeTruthy();
  });

  test('MapTiler tiles load successfully (no 4xx/5xx)', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes(EXPECTED_TILE_HOST) && TILE_ZXY.test(url) && res.status() >= 400) {
        failed.push(`${res.status()} ${url.split('?')[0]}`);
      }
    });

    await gotoMap(page);
    await page.waitForTimeout(2500);

    expect(
      failed,
      `MapTiler tile requests failed — is http://localhost:3000 added to the key's allowed origins?\n${failed.join('\n')}`,
    ).toHaveLength(0);
  });
});
