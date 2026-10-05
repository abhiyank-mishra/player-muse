/**
 * Download Whitelist System
 * Controls who can download songs for offline playback
 * 
 * Two tiers:
 * 1. ADMINS - Unlimited downloads, no storage limits
 * 2. WHITELISTED - Limited downloads (100 songs / 500 MB)
 */

// Admin users - unlimited downloads
const ADMIN_EMAILS = [
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || '',
].filter(Boolean);

/**
 * Check if user can download songs
 * @param email - User email for admin check
 * @param isPro - Role-based pro status from AuthContext
 */
export function canDownload(email: string | null | undefined, isPro?: boolean): boolean {
  if (isPro) return true;
  if (!email) return false;
  return isAdmin(email);
}

/**
 * Check if user is an admin (unlimited downloads)
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
