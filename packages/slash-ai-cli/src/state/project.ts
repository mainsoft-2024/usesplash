import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { ProjectConfigSchema, type ProjectConfig } from '../schemas/project.js';
import { getProjectJsonPath } from '../utils/env.js';

const CURRENT_SCHEMA_VERSION = '1.1.0';

function defaultTechPreference(platform: 'cloud' | 'local'): ProjectConfig['preferences']['techPreference'] {
  return platform === 'cloud' ? 'none' : 'high';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function assertKnownKeys(value: unknown, allowed: readonly string[], path: string): void {
  const record = asRecord(value);
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new Error(`Unknown project.json key "${path ? `${path}.` : ''}${key}". Remove it or migrate it into a supported field.`);
    }
  }
}

function assertKnownRawProjectKeys(obj: Record<string, unknown>): void {
  assertKnownKeys(obj, [
    'schemaVersion',
    'projectId',
    'createdAt',
    'updatedAt',
    'platform',
    'app',
    'preferences',
    'deployment',
    'resources',
    'devServers',
  ], '');

  if ('app' in obj) {
    assertKnownKeys(obj.app, ['type', 'framework', 'runtime'], 'app');
  }
  if ('preferences' in obj) {
    assertKnownKeys(obj.preferences, [
      'techPreference',
      'questionLevel',
      'designDocs',
      'subagentMode',
      'specDriven',
      'tdd',
    ], 'preferences');
  }
  if ('deployment' in obj) {
    assertKnownKeys(obj.deployment, ['provider', 'status', 'url', 'lastDeployedAt'], 'deployment');
  }
}

/**
 * Merges raw `preferences` with approved project defaults. `specDriven` remains unset (`null`) when absent
 * because the user explicitly requested a per-project choice for that workflow.
 */
function fillPreferencesFromRaw(
  preferences: Record<string, unknown>,
  platform: 'cloud' | 'local',
): Record<string, unknown> {
  return {
    techPreference: preferences.techPreference ?? defaultTechPreference(platform),
    questionLevel: preferences.questionLevel ?? 'medium',
    designDocs: preferences.designDocs ?? true,
    subagentMode: preferences.subagentMode ?? 'standard',
    specDriven: 'specDriven' in preferences ? preferences.specDriven : null,
    tdd: preferences.tdd ?? false,
  };
}

export function canonicalizeProjectConfig(config: ProjectConfig): ProjectConfig {
  return ProjectConfigSchema.parse({
    schemaVersion: config.schemaVersion,
    projectId: config.projectId,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    platform: config.platform,
    app: {
      type: config.app.type,
      framework: config.app.framework,
      runtime: config.app.runtime,
    },
    preferences: {
      techPreference: config.preferences.techPreference,
      questionLevel: config.preferences.questionLevel,
      designDocs: config.preferences.designDocs,
      subagentMode: config.preferences.subagentMode,
      specDriven: config.preferences.specDriven,
      tdd: config.preferences.tdd,
    },
    deployment: {
      provider: config.deployment.provider,
      status: config.deployment.status,
      url: config.deployment.url,
      lastDeployedAt: config.deployment.lastDeployedAt,
    },
    resources: config.resources.map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      role: resource.role,
      provider: resource.provider,
      externalId: resource.externalId,
      status: resource.status,
      connection: {
        urlEnv: resource.connection.urlEnv,
        tokenEnv: resource.connection.tokenEnv,
      },
      metadata: resource.metadata,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    })),
    devServers: config.devServers.map((server) => ({
      id: server.id,
      name: server.name,
      command: server.command,
      port: server.port,
      cwd: server.cwd,
      stopCommand: server.stopCommand,
      primary: server.primary,
    })),
  });
}

export function stringifyProjectConfig(config: ProjectConfig): string {
  return JSON.stringify(canonicalizeProjectConfig(config), null, 2) + '\n';
}

export function migrateProjectConfig(raw: unknown): ProjectConfig {
  const obj = asRecord(raw);
  assertKnownRawProjectKeys(obj);

  const version = typeof obj.schemaVersion === 'string' ? obj.schemaVersion : '0.0.0';
  const platform = (obj.platform ?? 'local') as 'cloud' | 'local';
  const preferences = asRecord(obj.preferences);

  if (version === CURRENT_SCHEMA_VERSION) {
    const merged = {
      ...obj,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      preferences: fillPreferencesFromRaw(preferences, platform),
    };
    return canonicalizeProjectConfig(ProjectConfigSchema.parse(merged));
  }

  // Migration from older schemaVersion (e.g. 1.0.0): preserve choices, apply approved defaults, keep specDriven unset.
  const now = new Date().toISOString();
  const app = asRecord(obj.app);
  const deployment = asRecord(obj.deployment);
  const migrated = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectId: obj.projectId ?? null,
    createdAt: obj.createdAt ?? now,
    updatedAt: now,
    platform,
    app: {
      type: app.type ?? 'webapp',
      framework: app.framework ?? null,
      runtime: app.runtime ?? null,
    },
    preferences: fillPreferencesFromRaw(preferences, platform),
    deployment: {
      provider: deployment.provider ?? 'none',
      status: deployment.status ?? 'not_deployed',
      url: deployment.url ?? null,
      lastDeployedAt: deployment.lastDeployedAt ?? null,
    },
    resources: Array.isArray(obj.resources) ? obj.resources : [],
    devServers: Array.isArray(obj.devServers) ? obj.devServers : [],
  };

  return canonicalizeProjectConfig(ProjectConfigSchema.parse(migrated));
}

export function readProjectConfig(): ProjectConfig | null {
  const path = getProjectJsonPath();
  if (!existsSync(path)) return null;

  const existing = readFileSync(path, 'utf-8');
  const raw = JSON.parse(existing);
  const migrated = migrateProjectConfig(raw);
  const canonical = stringifyProjectConfig(migrated);
  if (existing !== canonical) {
    writeProjectConfig(migrated);
  }
  return migrated;
}

export function writeProjectConfig(config: ProjectConfig): void {
  const path = getProjectJsonPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Atomic write: temp file + rename
  const tmpPath = `${path}.tmp.${Date.now()}`;
  const data = stringifyProjectConfig(config);
  writeFileSync(tmpPath, data, 'utf-8');
  renameSync(tmpPath, path);
}

export function createFullProjectConfig(platform: 'cloud' | 'local'): ProjectConfig {
  const now = new Date().toISOString();
  return canonicalizeProjectConfig(ProjectConfigSchema.parse({
    schemaVersion: '1.1.0',
    projectId: null,
    createdAt: now,
    updatedAt: now,
    platform,
    app: {
      type: 'webapp',
      framework: null,
      runtime: null,
    },
    preferences: {
      techPreference: defaultTechPreference(platform),
      questionLevel: 'medium',
      designDocs: true,
      subagentMode: 'standard',
      specDriven: null,
      tdd: false,
    },
    deployment: {
      provider: 'none',
      status: 'not_deployed',
      url: null,
      lastDeployedAt: null,
    },
    resources: [],
    devServers: [],
  }));
}

export function createDefaultProjectConfig(platform: 'cloud' | 'local'): ProjectConfig {
  return createFullProjectConfig(platform);
}

export function updateProjectConfig(updates: Partial<ProjectConfig>): ProjectConfig {
  const current = readProjectConfig();
  if (!current) throw new Error('.slash/project.json does not exist. Run `slash-ai init` first.');

  const updated: ProjectConfig = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeProjectConfig(updated);
  return updated;
}

/**
 * Ensures canonical `.slash/` layout under a repository root (`projectRoot` = cwd of that repo).
 * Creates `.slash/workspace/{plans,research}`, `.slash/design`, and `.slash/design/pages/`.
 * @returns true if any directory was created
 */
export function ensureSlashProjectLayout(projectRoot: string): boolean {
  const slashRoot = join(projectRoot, '.slash');
  const dirs = [
    slashRoot,
    join(slashRoot, 'workspace', 'plans'),
    join(slashRoot, 'workspace', 'research'),
    join(slashRoot, 'design'),
    join(slashRoot, 'design', 'pages'),
  ];
  let created = false;
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      created = true;
    }
  }
  return created;
}

export function ensureProjectDirs(): void {
  ensureSlashProjectLayout(process.cwd());
}
