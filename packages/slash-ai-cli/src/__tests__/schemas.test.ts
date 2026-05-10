import { describe, test, expect } from 'bun:test';
import {
  ProjectConfigSchema,
  PreferencesSchema,
  DeploymentSchema,
  ResourceSchema,
  AppSchema,
} from '../schemas/project.js';
import { SessionStateSchema, LoadedPackSchema } from '../schemas/session.js';

describe('ProjectConfigSchema', () => {
  const fullPreferences = {
    techPreference: 'none' as const,
    questionLevel: 'medium' as const,
    designDocs: true,
    subagentMode: 'standard' as const,
    specDriven: true,
    tdd: false,
  };

  const validProject = {
    schemaVersion: '1.1.0',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
    platform: 'local',
    preferences: fullPreferences,
  };

  test('parses valid minimal project config', () => {
    const result = ProjectConfigSchema.safeParse(validProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toBe('local');
      expect(result.data.schemaVersion).toBe('1.1.0');
    }
  });

  test('rejects invalid techPreference', () => {
    const result = PreferencesSchema.safeParse({
      techPreference: 'extreme',
      questionLevel: 'medium',
      designDocs: true,
      subagentMode: 'standard',
      specDriven: true,
      tdd: false,
    });
    expect(result.success).toBe(false);
  });

  test('rejects missing required fields', () => {
    const result = ProjectConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects missing preferences (workflow fields are explicit, not back-filled)', () => {
    const result = ProjectConfigSchema.safeParse({
      schemaVersion: '1.1.0',
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
      platform: 'local',
    });
    expect(result.success).toBe(false);
  });

  test('allows workflow preferences to be null (unset) when all keys are present', () => {
    const result = ProjectConfigSchema.safeParse({
      ...validProject,
      preferences: {
        ...fullPreferences,
        subagentMode: null,
        specDriven: null,
        tdd: null,
      },
    });
    expect(result.success).toBe(true);
  });

  test('applies default values for non-workflow preferences when omitted inside preferences object', () => {
    const result = ProjectConfigSchema.safeParse({
      ...validProject,
      preferences: {
        subagentMode: 'standard',
        specDriven: true,
        tdd: false,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferences.techPreference).toBe('none');
      expect(result.data.preferences.questionLevel).toBe('medium');
      expect(result.data.preferences.designDocs).toBe(true);
    }
  });

  test('applies default values for deployment', () => {
    const result = ProjectConfigSchema.safeParse(validProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deployment.provider).toBe('none');
      expect(result.data.deployment.status).toBe('not_deployed');
      expect(result.data.deployment.url).toBe(null);
      expect(result.data.deployment.lastDeployedAt).toBe(null);
    }
  });

  test('applies default values for app', () => {
    const result = ProjectConfigSchema.safeParse(validProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.app.type).toBe('webapp');
      expect(result.data.app.framework).toBe(null);
      expect(result.data.app.runtime).toBe(null);
    }
  });

  test('defaults resources to empty array', () => {
    const result = ProjectConfigSchema.safeParse(validProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resources).toEqual([]);
    }
  });

  test('parses resource with env var references', () => {
    const project = {
      ...validProject,
      resources: [{
        id: 'db-1',
        kind: 'database',
        provider: 'turso',
        status: 'ready',
        connection: {
          urlEnv: 'DATABASE_URL',
          tokenEnv: 'DATABASE_TOKEN',
        },
        createdAt: '2026-04-10T00:00:00.000Z',
        updatedAt: '2026-04-10T00:00:00.000Z',
      }],
    };
    const result = ProjectConfigSchema.safeParse(project);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resources).toHaveLength(1);
      expect(result.data.resources[0].connection.urlEnv).toBe('DATABASE_URL');
      expect(result.data.resources[0].connection.tokenEnv).toBe('DATABASE_TOKEN');
    }
  });

  test('rejects invalid platform value', () => {
    const result = ProjectConfigSchema.safeParse({
      ...validProject,
      platform: 'hybrid',
    });
    expect(result.success).toBe(false);
  });

  test('rejects invalid app type', () => {
    const result = AppSchema.safeParse({ type: 'game' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid resource kind', () => {
    const result = ResourceSchema.safeParse({
      id: 'x',
      kind: 'quantum',
      provider: 'acme',
      status: 'ready',
      connection: { urlEnv: 'X_URL' },
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  test('rejects invalid deployment status', () => {
    const result = DeploymentSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });
});

describe('SessionStateSchema', () => {
  test('validates correctly with all fields', () => {
    const session = {
      startedAt: '2026-04-10T00:00:00.000Z',
      activeIntent: 'implementation',
      loadedPacks: [],
      lastTransitionAt: null,
      contentManifestVersion: 'local',
    };
    const result = SessionStateSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeIntent).toBe('implementation');
    }
  });

  test('allows null activeIntent', () => {
    const session = {
      startedAt: '2026-04-10T00:00:00.000Z',
      activeIntent: null,
      loadedPacks: [],
      lastTransitionAt: null,
      contentManifestVersion: 'local',
    };
    const result = SessionStateSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeIntent).toBe(null);
    }
  });

  test('defaults activeIntent to null', () => {
    const session = {
      startedAt: '2026-04-10T00:00:00.000Z',
      loadedPacks: [],
      contentManifestVersion: 'local',
    };
    const result = SessionStateSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeIntent).toBe(null);
    }
  });

  test('defaults loadedPacks to empty array', () => {
    const session = {
      startedAt: '2026-04-10T00:00:00.000Z',
      contentManifestVersion: 'local',
    };
    const result = SessionStateSchema.safeParse(session);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loadedPacks).toEqual([]);
    }
  });

  test('rejects invalid activeIntent', () => {
    const session = {
      startedAt: '2026-04-10T00:00:00.000Z',
      activeIntent: 'debugging',
      contentManifestVersion: 'local',
    };
    const result = SessionStateSchema.safeParse(session);
    expect(result.success).toBe(false);
  });

  test('LoadedPackSchema validates correctly', () => {
    const pack = {
      name: 'create-spec',
      type: 'additive',
      loadedAt: '2026-04-10T00:00:00.000Z',
      contentVersion: 'local',
    };
    const result = LoadedPackSchema.safeParse(pack);
    expect(result.success).toBe(true);
  });

  test('LoadedPackSchema rejects invalid type', () => {
    const pack = {
      name: 'test',
      type: 'permanent',
      loadedAt: '2026-04-10T00:00:00.000Z',
      contentVersion: 'local',
    };
    const result = LoadedPackSchema.safeParse(pack);
    expect(result.success).toBe(false);
  });
});