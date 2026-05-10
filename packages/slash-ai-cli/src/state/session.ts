import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { SessionStateSchema, type SessionState, type LoadedPack } from '../schemas/session.js';
import { getSessionJsonPath } from '../utils/env.js';

export function readSession(): SessionState | null {
  const path = getSessionJsonPath();
  if (!existsSync(path)) return null;

  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const result = SessionStateSchema.safeParse(raw);
  if (!result.success) return null;
  return result.data;
}

export function writeSession(session: SessionState): void {
  const path = getSessionJsonPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const tmpPath = `${path}.tmp.${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(session, null, 2) + '\n', 'utf-8');
  renameSync(tmpPath, path);
}

export function createSession(manifestVersion: string): SessionState {
  const session: SessionState = {
    startedAt: new Date().toISOString(),
    activeIntent: null,
    loadedPacks: [],
    lastTransitionAt: null,
    contentManifestVersion: manifestVersion,
  };
  writeSession(session);
  return session;
}

export function addLoadedPack(session: SessionState, pack: LoadedPack): SessionState {
  const updated = { ...session };

  if (pack.type === 'replace-primary') {
    // Replace existing primary intent
    updated.loadedPacks = [
      ...session.loadedPacks.filter((p) => p.type !== 'replace-primary'),
      pack,
    ];
    // Set activeIntent based on pack name
    if (pack.name === 'implementation') updated.activeIntent = 'implementation';
    else if (pack.name === 'exploration') updated.activeIntent = 'exploration';
    updated.lastTransitionAt = new Date().toISOString();
  } else {
    // Additive or ephemeral — just append
    updated.loadedPacks = [...session.loadedPacks, pack];
  }

  writeSession(updated);
  return updated;
}
