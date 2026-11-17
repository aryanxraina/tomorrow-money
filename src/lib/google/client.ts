'use client';

// Google sign-in in the browser (Google Identity Services, token model).
// No server is involved and no Google secret is needed: the browser gets a short-lived access token
// (about an hour) and talks to Google directly, like the Gmail reading the project already plans.
// The token lives in this tab's session storage only, so it's gone when the browser is closed.

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || '';
export const googleConfigured = () => GOOGLE_CLIENT_ID.length > 0;

/** Sign-in asks for the person's name and email, and a private app folder in their own Drive. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const BASE_SCOPE = `openid email profile ${DRIVE_SCOPE}`;
/** Lets Tomorrow add bill reminders to the person's own calendar. Optional: they can untick it. */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
/** Signing in asks for everything at once, so reminders can start without a second permission screen. */
export const SIGNIN_SCOPE = `${BASE_SCOPE} ${CALENDAR_SCOPE}`;

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: () => void;
}
interface GoogleOAuth {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    include_granted_scopes?: boolean;
    prompt?: string;
    hint?: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string }) => void;
  }) => TokenClient;
  revoke: (token: string, done: () => void) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } };
  }
}

export class NeedsReconnect extends Error {
  constructor(message = 'Reconnect your Google account to continue.') {
    super(message);
  }
}

/** Google's permission screen lets people untick a box. Without the Drive one, nothing can be saved. */
export const DRIVE_PERMISSION_HELP = 'Google didn’t give Tomorrow permission to save your data. Tap “Allow saving” and tick the box for Tomorrow’s own data in your Google Drive.';
export class MissingDrivePermission extends NeedsReconnect {
  constructor() {
    super(DRIVE_PERMISSION_HELP);
  }
}

let loading: Promise<void> | null = null;

/** Loads Google's sign-in script only when someone actually signs in. */
export function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Couldn’t reach Google. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

const TOKEN_KEY = 'tomorrow-google-token';
interface StoredToken {
  token: string;
  exp: number;
  scope: string;
}

/** The current access token, if there is one with at least a minute left. */
export function currentToken(): StoredToken | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null') as StoredToken | null;
    return t && t.exp > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

export const hasScope = (scope: string) => !!currentToken()?.scope.split(' ').includes(scope);

function dropToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing stored */
  }
}

/** Opens Google's window to sign in or grant access. Must be called from a tap or click. */
export async function requestToken(scope: string, opts: { hint?: string; prompt?: '' | 'consent' | 'select_account' } = {}): Promise<StoredToken> {
  await loadGoogle();
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) throw new Error('Google sign-in didn’t load. Try again.');
  return new Promise((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope,
      include_granted_scopes: true,
      prompt: opts.prompt ?? '',
      hint: opts.hint,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error === 'access_denied' ? 'Access wasn’t allowed, so we couldn’t continue.' : r.error_description || 'Google sign-in didn’t finish.'));
        const t = { token: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000, scope: r.scope ?? scope };
        try {
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
        } catch {
          /* the token still works for this page */
        }
        resolve(t);
      },
      error_callback: (e) =>
        reject(
          new Error(
            e.type === 'popup_closed'
              ? 'The Google window was closed before you finished.'
              : e.type === 'popup_failed_to_open'
                ? 'Your browser blocked the Google window. Allow pop-ups for this site and try again.'
                : 'Google sign-in didn’t work. Try again.',
          ),
        ),
    });
    client.requestAccessToken();
  });
}

/** Forgets the token on this device and tells Google to cancel it. */
export function forgetToken() {
  const t = currentToken();
  dropToken();
  if (t) window.google?.accounts?.oauth2?.revoke(t.token, () => undefined);
}

/** fetch() to a Google API with the current token. A missing or expired token asks for a reconnect. */
export async function gfetch(url: string, init: RequestInit = {}): Promise<Response> {
  const t = currentToken();
  if (!t) throw new NeedsReconnect();
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${t.token}` } });
  if (res.status === 401) {
    dropToken();
    throw new NeedsReconnect();
  }
  return res;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  picture?: string;
}

export async function fetchProfile(): Promise<GoogleProfile> {
  const r = await gfetch('https://www.googleapis.com/oauth2/v3/userinfo');
  if (!r.ok) throw new Error('Couldn’t read your Google profile.');
  return (await r.json()) as GoogleProfile;
}
