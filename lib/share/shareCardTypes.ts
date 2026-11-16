export interface ShareCardImageOptions {
  /** File name of the PNG, e.g. "animatch-my-aura.png". */
  fileName: string;
  /** Share sheet title / subject. */
  title: string;
  /** Text sent along with the image; the link is appended to it. */
  message: string;
  /** App link with its ?ref= tag. */
  url: string;
}

/** shared: sent to an app. dismissed: share sheet closed. downloaded: PNG saved (web fallback). */
export type ShareCardOutcome = 'shared' | 'dismissed' | 'downloaded';

/** Resolves after React has committed and the browser / native side has painted. */
export function waitForNextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60)));
  });
}
