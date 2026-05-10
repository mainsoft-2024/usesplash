import { z } from 'zod';

export const LoadedPackSchema = z.object({
  name: z.string(),
  type: z.enum(['replace-primary', 'additive', 'ephemeral']),
  loadedAt: z.string(),
  contentVersion: z.string(),
});

export const SessionStateSchema = z.object({
  startedAt: z.string(),
  activeIntent: z.enum(['exploration', 'implementation']).nullable().default(null),
  loadedPacks: z.array(LoadedPackSchema).default([]),
  lastTransitionAt: z.string().nullable().default(null),
  contentManifestVersion: z.string(),
});

export type SessionState = z.infer<typeof SessionStateSchema>;
export type LoadedPack = z.infer<typeof LoadedPackSchema>;
