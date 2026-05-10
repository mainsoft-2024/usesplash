import {
  createFullProjectConfig,
  migrateProjectConfig,
  readProjectConfig,
  stringifyProjectConfig,
  writeProjectConfig,
} from '../state/project.js';
import {
  buildInvalidProjectConfigIssue,
  formatProjectConfigIssues,
  listProjectConfigIssues,
} from '../state/project-completeness.js';
import { getProjectConfigJsonSchema } from '../schemas/project.js';
import { output, error } from '../utils/output.js';
import { existsSync, readFileSync } from 'fs';
import { getProjectDir, getProjectJsonPath } from '../utils/env.js';
import { join } from 'path';

export async function projectStatus(): Promise<void> {
  const config = readProjectConfig();
  if (!config) {
    error('.slash/project.json not found. Run `slash-ai init` first.');
    process.exit(1);
  }

  const lines = [
    '## Project Status',
    '',
    `Platform: ${config.platform}`,
    `App Type: ${config.app.type}`,
    config.app.framework ? `Framework: ${config.app.framework}` : null,
    config.app.runtime ? `Runtime: ${config.app.runtime}` : null,
    '',
    '### Preferences',
    `  Tech Preference: ${config.preferences.techPreference}`,
    `  Question Level: ${config.preferences.questionLevel}`,
    `  Design Docs: ${config.preferences.designDocs}`,
    `  Subagent Mode: ${config.preferences.subagentMode === null ? '(unset)' : config.preferences.subagentMode}`,
    `  Spec driven: ${config.preferences.specDriven === null ? '(unset)' : String(config.preferences.specDriven)}`,
    `  TDD: ${config.preferences.tdd === null ? '(unset)' : String(config.preferences.tdd)}`,
    '',
    '### Deployment',
    `  Provider: ${config.deployment.provider}`,
    `  Status: ${config.deployment.status}`,
    config.deployment.url ? `  URL: ${config.deployment.url}` : null,
    config.deployment.lastDeployedAt
      ? `  Last Deployed: ${config.deployment.lastDeployedAt}`
      : null,
    '',
    `### Resources (${config.resources.length})`,
    ...config.resources.map(
      (r) => `  - ${r.id} [${r.kind}/${r.provider}] status=${r.status} env=${r.connection.urlEnv}`,
    ),
  ].filter(Boolean);

  output(lines.join('\n') + '\n');
}

export async function projectDoctor(): Promise<void> {
  const issues: string[] = [];
  const projectDir = getProjectDir();

  // Check .slash/ exists
  if (!existsSync(projectDir)) {
    issues.push('CRITICAL: .slash/ directory does not exist');
  }

  // Check project.json
  try {
    const config = readProjectConfig();
    if (!config) {
      issues.push('CRITICAL: .slash/project.json does not exist or is invalid');
    } else {
      // Check required dirs
      for (const sub of ['workspace/plans', 'workspace/research', 'design', 'design/pages']) {
        if (!existsSync(join(projectDir, sub))) {
          issues.push(`WARN: .slash/${sub}/ directory missing`);
        }
      }

      const legacyDesignDir = join(projectDir, 'workspace', 'design');
      if (existsSync(legacyDesignDir)) {
        issues.push(
          'WARN: Legacy `.slash/workspace/design/` exists — canonical path is `.slash/design/`; move contents and remove the old folder',
        );
      }

      // Check env var references in resources
      for (const r of config.resources) {
        if (r.connection.urlEnv && !process.env[r.connection.urlEnv]) {
          issues.push(
            `WARN: Resource ${r.id} references env var ${r.connection.urlEnv} which is not set`,
          );
        }
        if (r.connection.tokenEnv && !process.env[r.connection.tokenEnv]) {
          issues.push(
            `WARN: Resource ${r.id} references env var ${r.connection.tokenEnv} which is not set`,
          );
        }
      }

      const configIssues = listProjectConfigIssues(config);
      if (configIssues.length > 0) {
        issues.push(formatProjectConfigIssues(configIssues));
      }
    }
  } catch (e) {
    issues.push(formatProjectConfigIssues([
      buildInvalidProjectConfigIssue(e instanceof Error ? e.message : String(e)),
    ]));
  }

  // Check openspec
  if (!existsSync(join(process.cwd(), 'openspec'))) {
    issues.push('WARN: openspec/ directory not found');
  }

  if (issues.length === 0) {
    output('✓ Project health check passed. No issues found.\n');
  } else {
    output(`## Project Health Check — ${issues.length} issue(s)\n\n`);
    for (const issue of issues) {
      output(`- ${issue}\n`);
    }
  }
}

export async function projectMigrate(): Promise<void> {
  const path = getProjectJsonPath();
  if (!existsSync(path)) {
    error('.slash/project.json not found. Run `slash-ai init` first.');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const oldVersion = typeof (raw as Record<string, unknown>).schemaVersion === 'string'
    ? (raw as Record<string, unknown>).schemaVersion as string
    : '(none)';

  const migrated = migrateProjectConfig(raw);
  const newVersion = migrated.schemaVersion;

  // Compare and report changes
  const changes: string[] = [];
  if (oldVersion !== newVersion) {
    changes.push(`schemaVersion: ${oldVersion} → ${newVersion}`);
  }

  // Check each top-level field for defaults applied
  if (!(raw as Record<string, unknown>).platform) changes.push('platform: (missing) → local');
  if (!(raw as Record<string, unknown>).preferences) changes.push('preferences: (missing) → defaults applied');
  if (!(raw as Record<string, unknown>).deployment) changes.push('deployment: (missing) → defaults applied');
  if (!Array.isArray((raw as Record<string, unknown>).resources)) changes.push('resources: (missing) → []');

  writeProjectConfig(migrated);

  if (changes.length === 0) {
    output('Project config is already up to date. No changes needed.\n');
  } else {
    output(`Migrated project.json (v${oldVersion} → v${newVersion}):\n\n`);
    for (const change of changes) {
      output(`  - ${change}\n`);
    }
    output('\n');
  }
}

export async function projectSchema(): Promise<void> {
  output(JSON.stringify(getProjectConfigJsonSchema(), null, 2) + '\n');
}

export async function projectTemplate(): Promise<void> {
  output(stringifyProjectConfig(createFullProjectConfig('local')));
}

export async function projectCheck(strict = false, requireWorkflow = false): Promise<void> {
  const path = getProjectJsonPath();
  if (!existsSync(path)) {
    error('.slash/project.json not found. Run `slash-ai init` first.');
    process.exit(1);
  }

  const existing = readFileSync(path, 'utf-8');
  let canonical: string;
  let migrated: ReturnType<typeof migrateProjectConfig>;
  try {
    migrated = migrateProjectConfig(JSON.parse(existing));
    canonical = stringifyProjectConfig(migrated);
  } catch (e) {
    error(`project.json validation failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  if (strict && existing !== canonical) {
    error('project.json is valid but not canonical. Run `slash-ai project migrate` to repair safe drift.');
    process.exit(1);
  }

  if (requireWorkflow) {
    const blockingIssues = listProjectConfigIssues(migrated)
      .filter((issue) => issue.severity === 'critical');
    if (blockingIssues.length > 0) {
      error(
        'Project config still has unresolved required settings:\n' +
          formatProjectConfigIssues(blockingIssues) +
          '\n',
      );
      process.exit(1);
    }
  }

  if (strict) {
    output('✓ project.json is strict-canonical.\n');
  } else if (requireWorkflow) {
    output('✓ project.json is valid and workflow preferences are set.\n');
  } else {
    output('✓ project.json is valid.\n');
  }
}
