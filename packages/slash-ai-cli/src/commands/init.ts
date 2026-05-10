import { existsSync } from 'fs';
import { execSync } from 'child_process';
import {
  ensureProjectDirs,
  readProjectConfig,
  writeProjectConfig,
  createDefaultProjectConfig,
} from '../state/project.js';
import { isCloudEnvironment, getProjectJsonPath } from '../utils/env.js';
import { info, output } from '../utils/output.js';

export function initCommand(): void {
  const projectJsonPath = getProjectJsonPath();

  // Create directory structure
  ensureProjectDirs();

  // Handle project.json
  if (existsSync(projectJsonPath)) {
    // Cloud: preserve pre-existing project.json
    const existing = readProjectConfig();
    if (existing) {
      info(`Existing project.json found (platform: ${existing.platform}). Preserving.`);
    }
  } else {
    // Create new project.json with defaults
    const platform = isCloudEnvironment() ? 'cloud' : 'local';
    const config = createDefaultProjectConfig(platform);

    if (platform === 'cloud') {
      config.app.framework = 'nextjs';
      config.app.runtime = 'bun';
      config.deployment.provider = 'coolify';
    }

    writeProjectConfig(config);
    info(`Created project.json (platform: ${platform})`);
  }

  // Run openspec init
  try {
    execSync('openspec init --tools opencode', {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
    info('OpenSpec initialized.');
  } catch {
    info('OpenSpec init skipped (openspec not installed or already initialized).');
  }

  output('✓ S/ASH project initialized. `.slash/` directory ready.\n');
  output(
    'Next: run `slash-ai start` in the agent so runtime policy and project context load. ' +
      'If app.framework, app.runtime, or other fields are still empty, complete them in chat (ask_user_questions) or with `slash-ai config set <path> <value>`.\n',
  );
}
