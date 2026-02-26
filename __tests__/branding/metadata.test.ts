import { readFileSync } from 'node:fs';

import {
  BRAND_ASSET_PATHS,
  BRAND_THEME_COLORS,
  SITE_WEB_MANIFEST,
  createAppMetadata,
} from '@/lib/branding/metadata';

describe('createAppMetadata', () => {
  it('wires icons, manifest, and open graph branding assets', () => {
    const metadata = createAppMetadata('https://example.com');
    const icons = metadata.icons;

    expect(metadata.applicationName).toBe('the board');
    expect(metadata.manifest).toBe(BRAND_ASSET_PATHS.manifest);
    if (!icons || Array.isArray(icons) || typeof icons === 'string' || icons instanceof URL) {
      throw new Error('Expected metadata.icons to be an Icons object');
    }

    expect(icons.icon).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: '/favicon.ico' }),
        expect.objectContaining({ url: '/icon-32x32.png', sizes: '32x32' }),
        expect.objectContaining({ url: '/icon-192x192.png', sizes: '192x192' }),
      ]),
    );
    expect(icons.apple).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: '/icon-180x180.png', sizes: '180x180' }),
      ]),
    );
    expect(metadata.openGraph?.images).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: BRAND_ASSET_PATHS.openGraphLogo })]),
    );
    expect(metadata.metadataBase?.toString()).toBe('https://example.com/');
  });

  it('falls back to localhost metadataBase when the provided URL is invalid', () => {
    const metadata = createAppMetadata('not-a-url');

    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
  });
});

describe('site.webmanifest', () => {
  it('matches the branding manifest constants and required theme colors', () => {
    const manifestJson = JSON.parse(
      readFileSync('public/site.webmanifest', 'utf8'),
    ) as typeof SITE_WEB_MANIFEST;

    expect(manifestJson).toEqual(SITE_WEB_MANIFEST);
    expect(manifestJson.theme_color).toBe(BRAND_THEME_COLORS.theme);
    expect(manifestJson.background_color).toBe(BRAND_THEME_COLORS.background);
  });
});
