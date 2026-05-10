import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const API_BASE = process.env.SLASH_API_URL ?? 'https://slash.ai.kr/api/cli';

/**
 * Dev mode: SLASH_CONTENT_DIR must be explicitly set.
 * No auto-detection — dev mode is an intentional opt-in.
 */
function getDevContentDir(): string | null {
  return process.env.SLASH_CONTENT_DIR ?? null;
}

function readLocalFile(relativePath: string): string | null {
  const dir = getDevContentDir();
  if (!dir) return null;
  const fullPath = join(dir, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf-8');
}

async function fetchRemote(path: string): Promise<string | null> {
  const apiKey = process.env.SLASH_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${API_BASE}/content/${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content: string };
    return data.content;
  } catch {
    return null;
  }
}

/**
 * Resolution: dev local → remote API → error.
 */
export async function resolveContent(packName: string): Promise<string> {
  const path = `instructions/${packName}.md`;

  // 1. Dev mode (inside MAD-Agentic-system)
  const local = readLocalFile(path);
  if (local) return local;

  // 2. Remote API (slash.ai.kr)
  const remote = await fetchRemote(path);
  if (remote) return remote;

  return `[slash-ai error] Instruction pack "${packName}" not found. Set SLASH_AI_API_KEY or run from MAD-Agentic-system repo.`;
}

export async function resolveContext(contextName: string): Promise<string> {
  const path = `context/${contextName}.md`;

  const local = readLocalFile(path);
  if (local) return local;

  const remote = await fetchRemote(path);
  if (remote) return remote;

  return `[slash-ai error] Context "${contextName}" not found.`;
}