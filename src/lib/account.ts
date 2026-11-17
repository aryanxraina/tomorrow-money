'use client';

// Accounts. Each person signs in with Google and their data is saved to a private file in their own
// Google Drive (see google/drive.ts). This device keeps a working copy, so the app stays fast and works
// offline; changes are saved back to Drive shortly after they happen.
//
// Keeping people apart: the device remembers whose copy it holds. Signing out saves the latest
// changes, then clears the device, so the next person never sees the last one's money.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { currentToken, DRIVE_PERMISSION_HELP, DRIVE_SCOPE, fetchProfile, forgetToken, hasScope, MissingDrivePermission, NeedsReconnect, requestToken, SIGNIN_SCOPE } from './google/client';
import { deleteSaved, forgetFileId, readSaved, writeSaved, type SavedFile } from './google/drive';
import { personData, useStore, type PersonData } from './store';

export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  /** First name, used to suggest what we should call them. */
  given: string;
  picture: string | null;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'reconnect' | 'paused' | 'error';

interface AccountState {
  user: GoogleUser | null;
  /** When this device last saved to, or loaded from, Drive. */
  lastSync: string | null;
  /** There are changes on this device that aren't in Drive yet. */
  dirty: boolean;
  status: SyncStatus;
  error: string | null;
  /** Add upcoming bills to their Google Calendar without being asked each time. */
  autoCalendar: boolean;
  /** Reminders they removed, so automatic adding doesn't put them back. */
  skippedReminders: string[];
}

export const useAccount = create<AccountState>()(
  persist((): AccountState => ({ user: null, lastSync: null, dirty: false, status: 'idle', error: null, autoCalendar: true, skippedReminders: [] }), {
    name: 'tomorrow-account',
    storage: createJSONStorage(() => localStorage),
    partialize: ({ user, lastSync, dirty, autoCalendar, skippedReminders }) => ({ user, lastSync, dirty, autoCalendar, skippedReminders }),
  }),
);

const DATA_KEYS: (keyof PersonData)[] = ['answers', 'known', 'skipped', 'txns', 'accounts', 'rules', 'confirmed', 'bills', 'selected'];

/** True while Drive data is being put on the device, so that doesn't count as a new change. */
let applying = false;

function apply(data: PersonData) {
  applying = true;
  useStore.setState({ ...data });
  applying = false;
}

const localHasData = () => {
  const s = useStore.getState();
  return !!s.answers || s.txns.length > 0;
};

const paused = () => useStore.getState().mode === 'local';

/** How a failed save or load shows: reconnect (with the reason, if a permission is missing) or an error. */
const failure = (e: unknown): Partial<AccountState> =>
  e instanceof NeedsReconnect ? { status: 'reconnect', error: e instanceof MissingDrivePermission ? e.message : null } : { status: 'error', error: (e as Error).message };

/** Saves this device's data to the signed-in person's Drive. Safe to call any time. */
export async function syncNow(): Promise<void> {
  const { user } = useAccount.getState();
  if (!user) return;
  if (paused()) return void useAccount.setState({ status: 'paused' });
  if (!currentToken()) return void useAccount.setState({ status: 'reconnect' });
  useAccount.setState({ status: 'saving', error: null });
  try {
    const savedAt = await writeSaved(user.sub, personData());
    useAccount.setState({ status: 'saved', lastSync: savedAt, dirty: false });
  } catch (e) {
    useAccount.setState(failure(e));
  }
}

/** On opening the app: if another device saved something newer, and nothing here is unsaved, use it. */
export async function pullIfNewer(): Promise<void> {
  const { user, lastSync, dirty } = useAccount.getState();
  if (!user || paused() || !currentToken()) return;
  try {
    if (dirty) return void (await syncNow());
    const saved = await readSaved(user.sub);
    if (saved && (!lastSync || saved.savedAt > lastSync)) {
      apply(saved.data);
      useAccount.setState({ lastSync: saved.savedAt, status: 'saved' });
    }
  } catch (e) {
    useAccount.setState(failure(e));
  }
}

export type SignInResult =
  | { kind: 'returning' } // their saved data is now on this device
  | { kind: 'new' } // first time: carry on with the check-in
  | { kind: 'choose'; saved: SavedFile }; // data on this device and in their Drive: they decide

/** Signs in with Google (from a tap), then works out whose data this device should hold. */
export async function signInWithGoogle(): Promise<SignInResult> {
  await requestToken(SIGNIN_SCOPE, { prompt: 'select_account' });
  if (!hasScope(DRIVE_SCOPE)) {
    forgetToken();
    throw new Error(DRIVE_PERMISSION_HELP.replace('Tap “Allow saving” and tick', 'Try again and tick'));
  }
  const p = await fetchProfile();
  const user: GoogleUser = { sub: p.sub, email: p.email, name: p.name || p.email, given: p.given_name || '', picture: p.picture ?? null };
  const previous = useAccount.getState().user;

  // A different person's copy must never be shown to, or saved as, this person.
  if (previous && previous.sub !== user.sub) {
    apply({ ...EMPTY });
    forgetFileId();
  }
  useAccount.setState({ user, status: 'idle', error: null, ...(previous?.sub === user.sub ? {} : { lastSync: null, dirty: false, autoCalendar: true, skippedReminders: [] }) });

  const saved = await readSaved(user.sub);
  const hasLocal = localHasData();
  if (saved && !hasLocal) {
    apply(saved.data);
    useAccount.setState({ lastSync: saved.savedAt, dirty: false, status: 'saved' });
    return { kind: 'returning' };
  }
  if (saved && hasLocal) {
    // Their own copy from before: the newer side wins. Anything else, they choose.
    if (previous?.sub === user.sub) {
      await (useAccount.getState().dirty ? syncNow() : pullIfNewer());
      return { kind: 'returning' };
    }
    return { kind: 'choose', saved };
  }
  if (hasLocal) {
    await syncNow(); // money entered before signing in becomes theirs
    return { kind: 'returning' };
  }
  return { kind: 'new' };
}

/** After a 'choose' result: keep the Drive copy, or replace it with this device's data. */
export async function resolveChoice(keep: 'drive' | 'device', saved: SavedFile): Promise<void> {
  if (keep === 'drive') {
    apply(saved.data);
    useAccount.setState({ lastSync: saved.savedAt, dirty: false, status: 'saved' });
  } else {
    useAccount.setState({ dirty: true });
    await syncNow();
  }
}

/** Gets a fresh token (from a tap) and catches up: saves unsaved changes or loads newer ones. */
export async function reconnect(): Promise<void> {
  const { user } = useAccount.getState();
  if (!user) return;
  // If a permission was missing, show Google's full permission screen again so the box can be ticked.
  const missing = !!useAccount.getState().error || !hasScope(DRIVE_SCOPE);
  await requestToken(SIGNIN_SCOPE, { hint: user.email, prompt: missing ? 'consent' : '' });
  if (!hasScope(DRIVE_SCOPE)) {
    useAccount.setState({ status: 'reconnect', error: DRIVE_PERMISSION_HELP });
    throw new MissingDrivePermission();
  }
  useAccount.setState({ status: 'idle', error: null });
  await pullIfNewer();
}

const EMPTY: PersonData = { answers: null, known: [], skipped: [], txns: [], accounts: [], rules: {}, confirmed: [], bills: [], selected: null };

/**
 * Signs out: saves the latest changes if possible, then clears this device.
 * Returns false (and changes nothing) if there are unsaved changes that couldn't be saved, unless forced.
 */
export async function signOut(force = false): Promise<boolean> {
  const { dirty } = useAccount.getState();
  if (dirty && !paused() && currentToken()) await syncNow();
  if (useAccount.getState().dirty && !force) return false;
  forgetToken();
  forgetFileId();
  apply({ ...EMPTY });
  useAccount.setState({ user: null, lastSync: null, dirty: false, status: 'idle', error: null, autoCalendar: true, skippedReminders: [] });
  return true;
}

/** Removes the saved copy from the person's Drive (this device's copy is untouched). */
export async function deleteCloudCopy(): Promise<void> {
  const { user } = useAccount.getState();
  if (!user) return;
  await deleteSaved(user.sub);
  useAccount.setState({ lastSync: null, dirty: true, status: 'idle' });
}

/** Watches for changes to the person's data and saves them shortly after. Returns a stop function. */
export function startAutoSave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = useStore.subscribe((s, prev) => {
    if (applying || !useAccount.getState().user) return;
    // Turning "keep everything on this device" off again catches up on anything unsaved.
    if (prev.mode === 'local' && s.mode !== 'local' && useAccount.getState().dirty) void syncNow();
    if (!DATA_KEYS.some((k) => s[k] !== prev[k])) return;
    useAccount.setState({ dirty: true });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  });
  // Leaving the page or switching apps: save now rather than lose the last change.
  const flush = () => {
    if (document.visibilityState === 'hidden' && useAccount.getState().dirty) void syncNow();
  };
  document.addEventListener('visibilitychange', flush);
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', flush);
  };
}
