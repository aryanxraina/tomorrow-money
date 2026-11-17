/** Set by the check-in when it finishes, so Home can say once that the first overview is ready. */
export const WELCOME_FLAG = 'tomorrow-overview-ready';

export function markOverviewReady() {
  try {
    sessionStorage.setItem(WELCOME_FLAG, '1');
  } catch {
    /* storage unavailable: Home just won't show the welcome note */
  }
}
