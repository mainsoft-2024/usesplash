import { readProjectConfig } from '../state/project.js';
import { output, error, info } from '../utils/output.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export async function deployCheck(): Promise<void> {
  const config = readProjectConfig();
  if (!config) {
    error('.slash/project.json not found.');
    process.exit(1);
  }

  const issues: string[] = [];
  const checks: string[] = [];

  // Check .env.production exists
  const envProdPath = join(process.cwd(), '.env.production');
  if (existsSync(envProdPath)) {
    checks.push('✓ .env.production exists');
  } else {
    issues.push('✗ .env.production not found');
  }

  // Check resources are ready
  const notReady = config.resources.filter((r) => r.status !== 'ready');
  if (notReady.length > 0) {
    issues.push(
      `✗ ${notReady.length} resource(s) not ready: ${notReady.map((r) => r.id).join(', ')}`,
    );
  } else if (config.resources.length > 0) {
    checks.push(`✓ All ${config.resources.length} resource(s) ready`);
  }

  // Try build
  try {
    const buildCmd = existsSync(join(process.cwd(), 'bun.lockb'))
      ? 'bun run build'
      : 'npm run build';
    execSync(buildCmd, { cwd: process.cwd(), stdio: 'pipe', timeout: 120_000 });
    checks.push('✓ Build succeeds');
  } catch {
    issues.push('✗ Build failed');
  }

  // Report
  const ready = issues.length === 0;
  const lines = [
    `## Deploy Readiness: ${ready ? '✓ READY' : '✗ NOT READY'}`,
    '',
    ...checks,
    ...issues,
    '',
    ready
      ? 'All checks passed. Deploy via the web UI deploy button (🚀).'
      : 'Fix the issues above before deploying.',
  ];

  output(lines.join('\n') + '\n');
}
