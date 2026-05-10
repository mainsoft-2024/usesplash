import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveContent, resolveContext } from '../content/resolver.js';

let tempDir: string;
let origContentDir: string | undefined;
let origApiKey: string | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'slash-ai-test-'));
  origContentDir = process.env.SLASH_CONTENT_DIR;
  origApiKey = process.env.SLASH_AI_API_KEY;
  delete process.env.SLASH_CONTENT_DIR;
  delete process.env.SLASH_AI_API_KEY;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  if (origContentDir !== undefined) process.env.SLASH_CONTENT_DIR = origContentDir;
  else delete process.env.SLASH_CONTENT_DIR;
  if (origApiKey !== undefined) process.env.SLASH_AI_API_KEY = origApiKey;
  else delete process.env.SLASH_AI_API_KEY;
});

describe('resolveContent', () => {
  test('reads from SLASH_CONTENT_DIR when set', async () => {
    const instructionsDir = join(tempDir, 'instructions');
    mkdirSync(instructionsDir, { recursive: true });
    writeFileSync(join(instructionsDir, 'test-pack.md'), '# Test Pack Content\nThis is a test.');
    process.env.SLASH_CONTENT_DIR = tempDir;

    const result = await resolveContent('test-pack');
    expect(result).toBe('# Test Pack Content\nThis is a test.');
  });

  test('returns error when SLASH_CONTENT_DIR points to nonexistent dir', async () => {
    process.env.SLASH_CONTENT_DIR = join(tempDir, 'nonexistent');

    const result = await resolveContent('anything');
    expect(result).toContain('[slash-ai error]');
    expect(result).toContain('not found');
  });

  test('returns error when SLASH_CONTENT_DIR not set and no API key', async () => {
    // Both env vars deleted in beforeEach
    const result = await resolveContent('anything');
    expect(result).toContain('[slash-ai error]');
    expect(result).toContain('Set SLASH_AI_API_KEY');
  });

  test('returns error when instruction pack file does not exist in valid dir', async () => {
    const instructionsDir = join(tempDir, 'instructions');
    mkdirSync(instructionsDir, { recursive: true });
    process.env.SLASH_CONTENT_DIR = tempDir;

    const result = await resolveContent('nonexistent-pack');
    expect(result).toContain('[slash-ai error]');
    expect(result).toContain('nonexistent-pack');
  });
});

describe('resolveContext', () => {
  test('reads context from SLASH_CONTENT_DIR/context/', async () => {
    const contextDir = join(tempDir, 'context');
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, 'cloud.md'), '# Cloud Context\nCloud-specific info.');
    process.env.SLASH_CONTENT_DIR = tempDir;

    const result = await resolveContext('cloud');
    expect(result).toBe('# Cloud Context\nCloud-specific info.');
  });

  test('returns error when context file missing', async () => {
    const contextDir = join(tempDir, 'context');
    mkdirSync(contextDir, { recursive: true });
    process.env.SLASH_CONTENT_DIR = tempDir;

    const result = await resolveContext('missing');
    expect(result).toContain('[slash-ai error]');
    expect(result).toContain('Context');
  });

  test('returns error when no SLASH_CONTENT_DIR and no API key', async () => {
    const result = await resolveContext('cloud');
    expect(result).toContain('[slash-ai error]');
  });
});