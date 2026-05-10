import { output } from '../utils/output.js';

export function contentUpdate(): void {
  output('Content is loaded directly from local source. No update needed.\n');
}

export function contentLs(): void {
  output('Content is loaded directly from local source (modules/src/content/).\n');
}

export function contentRollback(_version: string): void {
  output('Content rollback not applicable in local source mode.\n');
}
