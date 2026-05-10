// Prefer the published CLI package version (next to dist/cli.js), then monorepo host.
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

let _version: string | null = null;

export function getVersion(): string {
  if (_version) return _version;

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [join(here, '..', 'package.json'), join(here, '..', '..', 'package.json')];
    for (const pkgPath of candidates) {
      if (!existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string; version?: string };
        if (pkg.name === '@mainsoft/slash-ai-cli' && pkg.version) {
          _version = pkg.version;
          return _version;
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* import.meta.url unavailable */
  }

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { name?: string; version?: string };
        if (pkg.name === 'mad-agentic-system' && pkg.version) {
          _version = pkg.version;
          return _version;
        }
      } catch {
        /* ignore */
      }
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  _version = '0.0.0';
  return _version;
}
