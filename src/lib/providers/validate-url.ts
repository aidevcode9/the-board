// ── SSRF Protection for Provider Base URLs ──────────────────────────────────
// Validates that admin-configured provider URLs don't point to internal
// network addresses (SSRF risk). See CLAUDE.md § Red Flags.

const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local (AWS metadata at 169.254.169.254)
  /^0\./, // "This" network
  /^\[?::1\]?$/, // IPv6 loopback
  /^\[?fc/, // IPv6 unique local
  /^\[?fd/, // IPv6 unique local
  /^\[?fe80/, // IPv6 link-local
];

const BLOCKED_HOSTNAMES = [
  'metadata.google.internal',
  'metadata.google',
  'kubernetes.default',
  'kubernetes.default.svc',
];

/**
 * Validate a provider base URL is safe (not pointing to internal networks).
 *
 * Rules:
 * 1. Must be a valid URL
 * 2. Must be HTTPS — except localhost (for LM Studio dev)
 * 3. Must not resolve to a private/internal IP range
 * 4. Must not be a known cloud metadata endpoint
 *
 * @returns `{ valid: true }` or `{ valid: false, reason: string }`
 */
export function validateProviderBaseUrl(
  url: string,
): { valid: true } | { valid: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Allow localhost for LM Studio (dev only)
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  // Enforce HTTPS for non-localhost URLs
  if (!isLocalhost && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Non-localhost URLs must use HTTPS' };
  }

  // Block known cloud metadata endpoints
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, reason: 'URL points to a blocked internal hostname' };
  }

  // Block private IP ranges (skip for localhost — already allowed)
  if (!isLocalhost) {
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: 'URL points to a private/internal IP address' };
      }
    }
  }

  return { valid: true };
}
