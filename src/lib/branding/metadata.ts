import type { Metadata } from 'next';

const FALLBACK_METADATA_BASE = 'http://localhost:3000';

export const BRAND_ASSET_PATHS = {
  favicon: '/favicon.ico',
  headerLogoDark: '/logo-dark.png',
  headerLogoLight: '/logo_light.png',
  loginLogoVertical: '/logo-v-transparent.png',
  manifest: '/site.webmanifest',
  openGraphLogo: '/logo-dark.png',
} as const;

export const BRAND_THEME_COLORS = {
  background: '#1a1714',
  theme: '#d4a257',
} as const;

const BRAND_DESCRIPTION =
  'Adversarial Persona Synthesis Engine — Three frontier models debate, challenge, and synthesize answers for senior AI engineering interview prep.';

const ICON_ENTRIES = [
  { url: BRAND_ASSET_PATHS.favicon, type: 'image/x-icon' },
  { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
  { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
  { url: '/icon-48x48.png', sizes: '48x48', type: 'image/png' },
  { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
  { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
];

const APPLE_ICON_ENTRIES = [{ url: '/icon-180x180.png', sizes: '180x180', type: 'image/png' }];

export const SITE_WEB_MANIFEST = {
  name: 'the board',
  short_name: 'the board',
  description: BRAND_DESCRIPTION,
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: BRAND_THEME_COLORS.background,
  theme_color: BRAND_THEME_COLORS.theme,
  icons: [
    { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
} as const;

export function createAppMetadata(appUrl?: string): Metadata {
  return {
    metadataBase: resolveMetadataBase(appUrl),
    title: 'The Board',
    applicationName: 'the board',
    description: BRAND_DESCRIPTION,
    manifest: BRAND_ASSET_PATHS.manifest,
    icons: {
      icon: ICON_ENTRIES,
      shortcut: [BRAND_ASSET_PATHS.favicon],
      apple: APPLE_ICON_ENTRIES,
    },
    openGraph: {
      title: 'The Board',
      description: BRAND_DESCRIPTION,
      type: 'website',
      siteName: 'the board',
      url: '/',
      images: [
        {
          url: BRAND_ASSET_PATHS.openGraphLogo,
          alt: 'the board logo',
        },
      ],
    },
  };
}

function resolveMetadataBase(appUrl?: string): URL {
  const raw = appUrl?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      // Fall through to localhost for local/dev and invalid config values.
    }
  }

  return new URL(FALLBACK_METADATA_BASE);
}
