import { existsSync } from 'fs';
import { join } from 'path';

export function isCloudEnvironment(): boolean {
  return !!process.env.SLASH_AI_API_KEY && !!process.env.E2B_SANDBOX_ID;
}

export function getApiKey(): string | undefined {
  return process.env.SLASH_AI_API_KEY;
}

export function getApiUrl(): string {
  return process.env.SLASH_API_URL ?? 'https://slash.ai.kr/api/cli';
}

export function getCacheDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
  return join(home, '.slash-ai', 'cache');
}

export function getProjectDir(): string {
  return join(process.cwd(), '.slash');
}

export function projectExists(): boolean {
  return existsSync(getProjectDir());
}

export function getProjectJsonPath(): string {
  return join(getProjectDir(), 'project.json');
}

export function getSessionJsonPath(): string {
  return join(getProjectDir(), 'session.json');
}
