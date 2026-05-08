import { readProjectConfig, updateProjectConfig } from '../state/project.js';
import { output, error, info } from '../utils/output.js';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

export async function infraProvisionDb(): Promise<void> {
  const apiUrl = process.env.SLASH_API_URL;
  const deployToken = process.env.SLASH_DEPLOY_TOKEN;

  if (!apiUrl || !deployToken) {
    error('SLASH_API_URL and SLASH_DEPLOY_TOKEN must be set for DB provisioning.');
    process.exit(1);
  }

  const config = readProjectConfig();
  if (!config) {
    error('.slash/project.json not found. Run `slash-ai init` first.');
    process.exit(1);
  }

  info('Provisioning Turso SQLite database...');

  try {
    const res = await fetch(`${apiUrl}/api/databases`, {
      method: 'POST',
      headers: {
        'x-deploy-token': deployToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: `project-db` }),
    });

    if (!res.ok) {
      const body = await res.text();
      error(`DB provisioning failed (${res.status}): ${body}`);
      process.exit(1);
    }

    const data = (await res.json()) as { url: string; authToken: string; name: string };

    // Write to .env.production
    const envPath = join(process.cwd(), '.env.production');
    const envLines = [`DATABASE_URL=${data.url}`, `DATABASE_AUTH_TOKEN=${data.authToken}`];

    if (existsSync(envPath)) {
      // Read existing, replace or append
      let content = readFileSync(envPath, 'utf-8');
      for (const line of envLines) {
        const key = line.split('=')[0];
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, line);
        } else {
          content += `\n${line}`;
        }
      }
      writeFileSync(envPath, content.trim() + '\n');
    } else {
      writeFileSync(envPath, envLines.join('\n') + '\n');
    }

    // Add resource to project.json
    const now = new Date().toISOString();
    const resource = {
      id: `res_db_${data.name}`,
      kind: 'database' as const,
      role: 'primary',
      provider: 'turso',
      externalId: data.name,
      status: 'ready' as const,
      connection: {
        urlEnv: 'DATABASE_URL',
        tokenEnv: 'DATABASE_AUTH_TOKEN',
      },
      metadata: {} as Record<string, string>,
      createdAt: now,
      updatedAt: now,
    };

    updateProjectConfig({
      resources: [...config.resources, resource],
    });

    output(`✓ Database provisioned: ${data.name}\n`);
    output(`  URL env: DATABASE_URL\n`);
    output(`  Token env: DATABASE_AUTH_TOKEN\n`);
    output(`  Written to .env.production\n`);
  } catch (e) {
    error(`DB provisioning error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

export async function infraList(): Promise<void> {
  const config = readProjectConfig();
  if (!config) {
    error('.slash/project.json not found.');
    process.exit(1);
  }

  if (config.resources.length === 0) {
    output('No managed resources.\n');
    return;
  }

  const lines = [
    '## Managed Resources',
    '',
    '| ID | Kind | Provider | Status | URL Env |',
    '|----|------|----------|--------|---------|',
    ...config.resources.map(
      (r) => `| ${r.id} | ${r.kind} | ${r.provider} | ${r.status} | ${r.connection.urlEnv} |`,
    ),
  ];

  output(lines.join('\n') + '\n');
}

export async function infraReconcile(): Promise<void> {
  const config = readProjectConfig();
  if (!config) {
    error('.slash/project.json not found. Run `slash-ai init` first.');
    process.exit(1);
  }

  if (config.resources.length === 0) {
    output('No managed resources to reconcile.\n');
    return;
  }

  const lines: string[] = ['## Resource Reconciliation', ''];
  let allOk = true;

  for (const r of config.resources) {
    const urlSet = r.connection.urlEnv ? !!process.env[r.connection.urlEnv] : false;
    const tokenSet = r.connection.tokenEnv ? !!process.env[r.connection.tokenEnv] : false;

    const statusParts: string[] = [];
    if (r.connection.urlEnv) {
      statusParts.push(urlSet ? `✓ ${r.connection.urlEnv}` : `✗ ${r.connection.urlEnv} MISSING`);
      if (!urlSet) allOk = false;
    }
    if (r.connection.tokenEnv) {
      statusParts.push(tokenSet ? `✓ ${r.connection.tokenEnv}` : `✗ ${r.connection.tokenEnv} MISSING`);
      if (!tokenSet) allOk = false;
    }

    const statusStr = statusParts.length > 0 ? statusParts.join(', ') : 'no env refs';
    lines.push(`  ${r.id} [${r.kind}/${r.provider}] — ${statusStr}`);
  }

  lines.push('');
  if (allOk) {
    lines.push('✓ All resource environment variables are set.');
  } else {
    lines.push('✗ Some environment variables are missing. Set them before deploying.');
  }

  output(lines.join('\n') + '\n');
}
