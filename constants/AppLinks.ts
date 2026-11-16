/** Public web URL of the app, used in share cards and share messages. */
export const APP_PUBLIC_URL = 'https://dynamic-boba-43fdd9.netlify.app';

/** Where a shared link came from, so visits can be attributed later. */
export type ShareRef = 'share-aura' | 'share-match';

/** The app link with a `?ref=` tag, e.g. https://…/?ref=share-aura */
export function buildShareUrl(ref: ShareRef): string {
  return `${APP_PUBLIC_URL}/?ref=${ref}`;
}

/** The app link without protocol, for display on the cards. */
export function getDisplayAppUrl(): string {
  return APP_PUBLIC_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
