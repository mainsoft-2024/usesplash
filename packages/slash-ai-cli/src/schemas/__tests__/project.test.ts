import { describe, expect, test } from 'vitest';
import { ProjectConfigSchema } from '../project.js';

const baseProject = {
  schemaVersion: '1.1.0' as const,
  createdAt: '2026-04-20T00:00:00.000Z',
  updatedAt: '2026-04-20T00:00:00.000Z',
  platform: 'cloud' as const,
  preferences: {
    techPreference: 'none' as const,
    questionLevel: 'medium' as const,
    designDocs: true,
    subagentMode: 'standard' as const,
    specDriven: true,
    tdd: false,
  },
};

function parseDevServer(devServer: unknown) {
  return ProjectConfigSchema.safeParse({
    ...baseProject,
    devServers: [devServer],
  });
}

describe('DevServerSchema', () => {
  test('parses valid config with minimal required fields', () => {
    const result = parseDevServer({
      id: 'web',
      name: 'Web',
      command: 'bun run dev',
      port: 5173,
    });

    expect(result.success).toBe(true);
  });

  test('parses valid kebab id with primary true', () => {
    const result = parseDevServer({
      id: 'api-server',
      name: 'API',
      command: 'bun run dev:api',
      port: 3000,
      primary: true,
    });

    expect(result.success).toBe(true);
  });

  test('fails when id is missing', () => {
    const result = parseDevServer({
      name: 'Web',
      command: 'bun run dev',
      port: 5173,
    });

    expect(result.success).toBe(false);
  });

  test('fails for uppercase id', () => {
    const result = parseDevServer({
      id: 'Web',
      name: 'Web',
      command: 'bun run dev',
      port: 5173,
    });

    expect(result.success).toBe(false);
  });

  test('fails for id with spaces', () => {
    const result = parseDevServer({
      id: 'api server',
      name: 'API',
      command: 'bun run dev:api',
      port: 3000,
    });

    expect(result.success).toBe(false);
  });

  test('fails for leading hyphen id', () => {
    const result = parseDevServer({
      id: '-api-server',
      name: 'API',
      command: 'bun run dev:api',
      port: 3000,
    });

    expect(result.success).toBe(false);
  });

  test('fails for trailing hyphen id', () => {
    const result = parseDevServer({
      id: 'api-server-',
      name: 'API',
      command: 'bun run dev:api',
      port: 3000,
    });

    expect(result.success).toBe(false);
  });

  test('fails for id over 32 chars', () => {
    const result = parseDevServer({
      id: 'abcdefghijklmnopqrstuvwxyzabcdefg',
      name: 'API',
      command: 'bun run dev:api',
      port: 3000,
    });

    expect(result.success).toBe(false);
  });

  test('parses when primary is omitted', () => {
    const result = parseDevServer({
      id: 'frontend',
      name: 'Frontend',
      command: 'bun run dev',
      port: 5173,
    });

    expect(result.success).toBe(true);
  });
});

describe('ProjectConfigSchema strict canonical shape', () => {
  test('rejects unknown top-level keys', () => {
    const result = ProjectConfigSchema.safeParse({
      ...baseProject,
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });

  test('materializes nullable app and project keys', () => {
    const result = ProjectConfigSchema.safeParse(baseProject);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe(null);
      expect(result.data.app.framework).toBe(null);
      expect(result.data.app.runtime).toBe(null);
      expect(result.data.preferences.subagentMode).toBe('standard');
      expect(result.data.preferences.specDriven).toBe(true);
      expect(result.data.preferences.tdd).toBe(false);
      expect(result.data.devServers).toEqual([]);
    }
  });
});
