'use client';

// Each person's data is one private file in the hidden app folder of their own Google Drive.
// Only they and this app can open it, it doesn't clutter their Drive, and accounts never mix.
import type { PersonData } from '../store';
import { gfetch, MissingDrivePermission } from './client';

const FILE_NAME = 'tomorrow-data.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export interface SavedFile {
  app: 'tomorrow';
  version: 1;
  savedAt: string;
  data: PersonData;
}

let cachedId: { owner: string; id: string } | null = null;

async function problem(r: Response, what: string) {
  const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (r.status === 403 && /insufficient/i.test(j?.error?.message ?? '')) return new MissingDrivePermission();
  return new Error(`${what} (${r.status}${j?.error?.message ? `: ${j.error.message}` : ''})`);
}

async function findFileId(owner: string): Promise<string | null> {
  if (cachedId?.owner === owner) return cachedId.id;
  const q = new URLSearchParams({ spaces: 'appDataFolder', q: `name='${FILE_NAME}' and trashed=false`, fields: 'files(id)', pageSize: '1' });
  const r = await gfetch(`${API}?${q}`);
  if (!r.ok) throw await problem(r, 'Couldn’t look in your Google Drive');
  const id = ((await r.json()) as { files?: { id: string }[] }).files?.[0]?.id ?? null;
  if (id) cachedId = { owner, id };
  return id;
}

/** A plausible saved file, so a damaged one is never loaded over someone's data. */
function looksValid(x: unknown): x is SavedFile {
  const f = x as SavedFile;
  return !!f && f.app === 'tomorrow' && !!f.data && Array.isArray(f.data.txns) && Array.isArray(f.data.known);
}

export async function readSaved(owner: string): Promise<SavedFile | null> {
  const id = await findFileId(owner);
  if (!id) return null;
  const r = await gfetch(`${API}/${id}?alt=media`);
  if (!r.ok) throw await problem(r, 'Couldn’t read your saved data');
  const json = await r.json().catch(() => null);
  return looksValid(json) ? json : null;
}

export async function writeSaved(owner: string, data: PersonData): Promise<string> {
  const savedAt = new Date().toISOString();
  const file: SavedFile = { app: 'tomorrow', version: 1, savedAt, data };
  const id = await findFileId(owner);
  const boundary = `tomorrow-${Math.random().toString(36).slice(2)}`;
  const meta = id ? {} : { name: FILE_NAME, parents: ['appDataFolder'] };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(file)}\r\n--${boundary}--`;
  const r = await gfetch(id ? `${UPLOAD}/${id}?uploadType=multipart&fields=id` : `${UPLOAD}?uploadType=multipart&fields=id`, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw await problem(r, 'Couldn’t save to your Google Drive');
  const created = (await r.json()) as { id: string };
  cachedId = { owner, id: created.id };
  return savedAt;
}

export async function deleteSaved(owner: string): Promise<void> {
  const id = await findFileId(owner);
  cachedId = null;
  if (!id) return;
  const r = await gfetch(`${API}/${id}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw await problem(r, 'Couldn’t delete your saved data');
}

export function forgetFileId() {
  cachedId = null;
}
