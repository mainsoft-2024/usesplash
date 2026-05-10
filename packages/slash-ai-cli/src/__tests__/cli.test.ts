import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Absolute path to CLI entry point (so it works from any cwd)
const CLI_ENTRY = join(import.meta.dir, '..', 'cli.ts');
const CLI = `bun run ${CLI_ENTRY}`;

// Pack fixtures shipped with this package (integration tests)
const CONTENT_DIR = join(import.meta.dir, '..', '..', 'fixtures', 'content');

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'slash-ai-cli-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function runCli(args: string, cwd?: string, env?: Record<string, string>): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execSync(`${CLI} ${args}`, {
      cwd: cwd ?? tempDir,
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      timeout: 15_000,
    });
    return { stdout: result, stderr: '', exitCode: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

describe('slash-ai init', () => {
  test('creates .slash/project.json with correct structure', () => {
    // openspec might not be installed in test env, so init might skip that part
    const result = runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    const projectJsonPath = join(tempDir, '.slash', 'project.json');
    expect(existsSync(projectJsonPath)).toBe(true);

    const config = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
    expect(config.schemaVersion).toBe('1.1.0');
    expect(config.platform).toBeDefined();
    expect(['cloud', 'local']).toContain(config.platform);
    expect(config.app).toBeDefined();
    expect(config.app.type).toBe('webapp');
    expect(config.preferences).toBeDefined();
    expect(config.preferences.techPreference).toBe('high');
    expect(config.preferences.subagentMode).toBe('standard');
    expect(config.preferences.specDriven).toBeNull();
    expect(config.preferences.tdd).toBe(false);
    expect(config.deployment).toBeDefined();
    expect(result.stdout).toContain('Next:');
    expect(result.stdout).toContain('slash-ai start');

    expect(existsSync(join(tempDir, '.slash', 'design', 'pages'))).toBe(true);
    expect(existsSync(join(tempDir, '.slash', 'workspace', 'plans'))).toBe(true);
    expect(existsSync(join(tempDir, '.slash', 'workspace', 'research'))).toBe(true);
  });

  test('preserves existing project.json on re-init', () => {
    runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    const projectJsonPath = join(tempDir, '.slash', 'project.json');
    const original = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));

    // Modify platform to cloud
    original.platform = 'cloud';
    writeFileSync(projectJsonPath, JSON.stringify(original, null, 2));

    // Re-init should preserve
    runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    const afterReinit = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
    expect(afterReinit.platform).toBe('cloud');
  });
});

describe('slash-ai start', () => {
  test('outputs content with header when SLASH_CONTENT_DIR is set', () => {
    // Init first
    runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });

    const result = runCli('start', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('<slash_project_config_remediation>');
    expect(result.stdout).toContain('Priority: ZERO');
    expect(result.stdout).toContain('preferences.specDriven');
    expect(result.stdout).toContain('slash-ai v');
    expect(result.stdout).toContain('mode:');
  });

  test('outputs remediation instead of raw failure for invalid project config', () => {
    runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    const projectJsonPath = join(tempDir, '.slash', 'project.json');
    const config = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
    config.dev = { command: 'npm run dev' };
    writeFileSync(projectJsonPath, JSON.stringify(config, null, 2));

    const result = runCli('start', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('<slash_project_config_remediation>');
    expect(result.stdout).toContain('Unknown project.json key "dev"');
  });
});

describe('slash-ai instruction', () => {
  test('outputs content with header for valid pack name', () => {
    runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });

    const result = runCli('instruction apply-spec', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('slash-ai v');
    expect(result.stdout).toContain('mode:');
    expect(result.stdout).toContain('pack: apply-spec');
  });

  test('exits with error for invalid pack name', () => {
    const result = runCli('instruction nonexistent-pack', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown instruction pack');
  });

  test('prints self-heal block when instruction pack cannot be resolved', () => {
    runCli('init', tempDir, {});
    const result = runCli('instruction implementation', tempDir, {
      SLASH_CONTENT_DIR: join(tempDir, 'no-such-content'),
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('[slash-ai error]');
    expect(result.stderr).toContain('<slash_ai_cli_self_heal>');
    expect(result.stderr).toContain('SLASH_AI_API_KEY');
  });
});

describe('slash-ai project', () => {
  test('project status outputs project info after init', () => {
    runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });

    const result = runCli('project status', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Project Status');
    expect(result.stdout).toContain('Platform:');
    expect(result.stdout).toContain('App Type:');
    expect(result.stdout).toContain('Subagent Mode:');
    expect(result.stdout).toContain('Spec driven:');
    expect(result.stdout).toContain('TDD:');
  });

  test('project check --workflow fails until required settings are filled', () => {
    runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });

    const missingResult = runCli('project check --workflow', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(missingResult.exitCode).toBe(1);
    expect(missingResult.stderr).toContain('Project config still has unresolved required settings');

    runCli('config set app.framework vite', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    runCli('config set app.runtime bun', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    runCli('config set preferences.specDriven false', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });

    const completeResult = runCli('project check --workflow', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(completeResult.exitCode).toBe(0);
    expect(completeResult.stdout).toContain('workflow preferences are set');
  });

  test('migrates old project config with approved local defaults and specDriven unset', () => {
    mkdirSync(join(tempDir, '.slash'), { recursive: true });
    const projectJsonPath = join(tempDir, '.slash', 'project.json');
    writeFileSync(projectJsonPath, JSON.stringify({
      schemaVersion: '1.0.0',
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
      platform: 'local',
      app: { type: 'webapp' },
      preferences: {
        questionLevel: 'medium',
        designDocs: true,
      },
      deployment: { provider: 'none', status: 'not_deployed' },
      resources: [],
    }, null, 2));

    const result = runCli('project status', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(result.exitCode).toBe(0);

    const migrated = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
    expect(migrated.schemaVersion).toBe('1.1.0');
    expect(migrated.preferences.techPreference).toBe('high');
    expect(migrated.preferences.subagentMode).toBe('standard');
    expect(migrated.preferences.specDriven).toBeNull();
    expect(migrated.preferences.tdd).toBe(false);
  });
});

describe('slash-ai config', () => {
  test('config set and get round-trip', () => {
    runCli('init', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });

    const setResult = runCli('config set preferences.techPreference high', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(setResult.exitCode).toBe(0);
    expect(setResult.stdout).toContain('techPreference');

    const getResult = runCli('config get preferences.techPreference', tempDir, { SLASH_CONTENT_DIR: CONTENT_DIR });
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout.trim()).toBe('high');
  });
});

describe('slash-ai --version', () => {
  test('outputs version', () => {
    const result = runCli('--version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+/);
  });
});