/**
 * Sanitize URL for safe use in href (XSS prevention).
 * Only allow http and https. Returns null for invalid/unsafe URLs.
 * @param {string} url - User-supplied URL
 * @returns {string|null} - Sanitized URL or null
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('https://') || lower.startsWith('http://')) {
    // Basic length cap to avoid abuse
    if (trimmed.length > 2048) return null;
    return trimmed;
  }
  return null;
}
