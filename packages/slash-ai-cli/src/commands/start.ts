import { migrateProjectConfig, stringifyProjectConfig, writeProjectConfig } from '../state/project.js';
import { createSession } from '../state/session.js';
import { resolveContent, resolveContext } from '../content/resolver.js';
import { projectExists, getProjectJsonPath } from '../utils/env.js';
import { output, resolverFailure, info } from '../utils/output.js';
import { selfHealContextFetch, selfHealInstructionFetch } from '../utils/heal-hints.js';
import { initCommand } from './init.js';
import { existsSync, readFileSync } from 'fs';
import { getVersion } from '../utils/version.js';
import { buildProjectMetadata, buildRuntimePolicy } from './runtime-policy.js';
import type { ProjectConfig } from '../schemas/project.js';
import {
  buildInvalidProjectConfigIssue,
  buildProjectConfigRemediationBlock,
  listProjectConfigIssues,
} from '../state/project-completeness.js';

export async function startCommand(): Promise<void> {
  // Auto-init if .slash/ doesn't exist OR project.json is missing
  if (!projectExists() || !existsSync(getProjectJsonPath())) {
    initCommand();
  }

  const projectJsonPath = getProjectJsonPath();
  const existing = readFileSync(projectJsonPath, 'utf-8');

  let config: ProjectConfig;
  let remediationBlock = '';
  try {
    const migrated = migrateProjectConfig(JSON.parse(existing));
    const canonical = stringifyProjectConfig(migrated);
    const issues = listProjectConfigIssues(migrated, {
      canonicalDrift: existing !== canonical,
    });
    if (existing !== canonical) {
      writeProjectConfig(migrated);
    }
    config = migrated;
    remediationBlock = buildProjectConfigRemediationBlock(issues);
  } catch (e) {
    const issue = buildInvalidProjectConfigIssue(e instanceof Error ? e.message : String(e));
    output(buildProjectConfigRemediationBlock([issue]) + '\n');
    return;
  }

  const startContent = await resolveContent('start');
  if (startContent.startsWith('[slash-ai error]')) {
    resolverFailure(startContent, selfHealInstructionFetch('start'));
    process.exit(1);
  }

  const contextName = config.platform === 'cloud' ? 'cloud' : 'local';
  const contextContent = await resolveContext(contextName);

  createSession('local');

  // Header with mode and version
  const readyHeader = `<!-- slash-ai v${getVersion()} | mode: ${config.platform} -->`;

  const sections: string[] = remediationBlock
    ? [remediationBlock, readyHeader, buildRuntimePolicy(config), startContent]
    : [readyHeader, buildRuntimePolicy(config), startContent];
  if (!contextContent.startsWith('[slash-ai error]')) {
    sections.push(contextContent);
  } else {
    info(contextContent);
    info(selfHealContextFetch(contextName));
  }
  sections.push(buildProjectMetadata(config));

  output(sections.join('\n\n'));
}
