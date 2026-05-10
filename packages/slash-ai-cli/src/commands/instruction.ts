import { resolveContent } from '../content/resolver.js';
import { readSession, addLoadedPack } from '../state/session.js';
import { output, error, resolverFailure } from '../utils/output.js';
import { selfHealInstructionFetch } from '../utils/heal-hints.js';
import { getVersion } from '../utils/version.js';
import { readProjectConfig } from '../state/project.js';
import { buildRuntimePolicy } from './runtime-policy.js';

const KNOWN_PACKS = [
  'start', 'implementation', 'exploration', 'create-spec',
  'apply-spec', 'nonspec', 'ui-design', 'verification', 'escalation',
] as const;

type PackName = (typeof KNOWN_PACKS)[number];

const PACK_TYPES: Record<PackName, 'replace-primary' | 'additive' | 'ephemeral'> = {
  start: 'replace-primary',
  implementation: 'replace-primary',
  exploration: 'replace-primary',
  'create-spec': 'additive',
  'apply-spec': 'additive',
  nonspec: 'additive',
  'ui-design': 'additive',
  verification: 'additive',
  escalation: 'ephemeral',
};

export async function instructionCommand(name: string): Promise<void> {
  if (!KNOWN_PACKS.includes(name as PackName)) {
    error(`Unknown instruction pack: "${name}"`);
    error(`Available: ${KNOWN_PACKS.join(', ')}`);
    process.exit(1);
  }

  const packName = name as PackName;
  const content = await resolveContent(packName);
  if (content.startsWith('[slash-ai error]')) {
    resolverFailure(content, selfHealInstructionFetch(packName));
    process.exit(1);
  }

  const session = readSession();
  if (session) {
    addLoadedPack(session, {
      name: packName,
      type: PACK_TYPES[packName],
      loadedAt: new Date().toISOString(),
      contentVersion: 'local',
    });
  }

  const config = readProjectConfig();
  const mode = config?.platform ?? 'local';
  const header = `<!-- slash-ai v${getVersion()} | mode: ${mode} | pack: ${packName} -->`;
  const policy = config ? buildRuntimePolicy(config) : '<slash_runtime_policy>\nProject config not found. Run `slash-ai start` first.\n</slash_runtime_policy>';

  output(header + '\n\n' + policy + '\n\n' + content);
}
