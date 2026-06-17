/**
 * Build the profile-image URL for a given cache-busting version, or null when the
 * user has no image. Centralizes the `imageVersion > 0 ? ... : null` expression that
 * was repeated across the panel, client, and connect pages.
 */
export function profileImageSrc(imageVersion: number | null | undefined): string | null {
  return imageVersion && imageVersion > 0 ? `/api/profile/getImage?v=${imageVersion}` : null;
}
