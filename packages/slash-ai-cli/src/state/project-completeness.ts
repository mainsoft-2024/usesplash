import type { ProjectConfig } from '../schemas/project.js';

/** Workflow fields that may use JSON `null` to mean "not chosen yet". */
export const UNSET_WORKFLOW_PREFERENCE_PATHS = [
  'preferences.subagentMode',
  'preferences.specDriven',
  'preferences.tdd',
] as const;

export type UnsetWorkflowPreferencePath = (typeof UNSET_WORKFLOW_PREFERENCE_PATHS)[number];

export type ProjectConfigIssueSeverity = 'critical' | 'warn';

export interface ProjectConfigIssue {
  severity: ProjectConfigIssueSeverity;
  path: string;
  code:
    | 'invalid'
    | 'canonical_drift'
    | 'unset'
    | 'unspecified_metadata';
  message: string;
  question?: string;
  proposedValue?: string;
  command?: string;
}

const WORKFLOW_FIELD_GUIDANCE: Record<UnsetWorkflowPreferencePath, {
  question: string;
  proposedValue?: string;
  command: string;
}> = {
  'preferences.subagentMode': {
    question: 'Subagent workflow preference is unset. Should agents use standard subagent behavior or prefer parallel delegation?',
    proposedValue: 'standard',
    command: 'slash-ai config set preferences.subagentMode standard',
  },
  'preferences.specDriven': {
    question: 'Spec-driven workflow is unset for this project. Should the agent use OpenSpec/spec-driven workflows for this project?',
    command: 'slash-ai config set preferences.specDriven true|false',
  },
  'preferences.tdd': {
    question: 'TDD preference is unset. Should the agent write failing tests before implementation by default?',
    proposedValue: 'false',
    command: 'slash-ai config set preferences.tdd false',
  },
};

export function listUnsetWorkflowPreferences(config: ProjectConfig): UnsetWorkflowPreferencePath[] {
  const p = config.preferences;
  const out: UnsetWorkflowPreferencePath[] = [];
  if (p.subagentMode === null) out.push('preferences.subagentMode');
  if (p.specDriven === null) out.push('preferences.specDriven');
  if (p.tdd === null) out.push('preferences.tdd');
  return out;
}

export function isWorkflowPolicyComplete(config: ProjectConfig): boolean {
  return listUnsetWorkflowPreferences(config).length === 0;
}

export function listProjectConfigIssues(
  config: ProjectConfig,
  options: { canonicalDrift?: boolean } = {},
): ProjectConfigIssue[] {
  const issues: ProjectConfigIssue[] = [];

  if (options.canonicalDrift) {
    issues.push({
      severity: 'warn',
      path: '.slash/project.json',
      code: 'canonical_drift',
      message: 'project.json was missing canonical fields or formatting and has been rewritten to the canonical shape.',
    });
  }

  if (config.app.framework == null) {
    issues.push({
      severity: 'critical',
      path: 'app.framework',
      code: 'unspecified_metadata',
      message: 'Project framework is unspecified.',
      question: 'What framework does this project use? For example: nextjs, vite, react-router, express, or none.',
      command: 'slash-ai config set app.framework <framework>',
    });
  }

  if (config.app.runtime == null) {
    issues.push({
      severity: 'critical',
      path: 'app.runtime',
      code: 'unspecified_metadata',
      message: 'Project runtime is unspecified.',
      question: 'What runtime should agents assume for this project? For example: bun, node, deno, or none.',
      command: 'slash-ai config set app.runtime <runtime>',
    });
  }

  for (const path of listUnsetWorkflowPreferences(config)) {
    const guidance = WORKFLOW_FIELD_GUIDANCE[path];
    issues.push({
      severity: 'critical',
      path,
      code: 'unset',
      message: `${path} is null (not chosen yet).`,
      question: guidance.question,
      proposedValue: guidance.proposedValue,
      command: guidance.command,
    });
  }

  return issues;
}

export function buildInvalidProjectConfigIssue(errorMessage: string): ProjectConfigIssue {
  return {
    severity: 'critical',
    path: '.slash/project.json',
    code: 'invalid',
    message: `project.json is invalid: ${errorMessage}`,
    question: 'project.json has invalid or unknown fields. Ask the user whether to remove the invalid fields or map them into supported fields before continuing.',
    command: 'slash-ai project doctor',
  };
}

export function formatProjectConfigIssues(issues: ProjectConfigIssue[]): string {
  return issues.map((issue) => {
    const lines = [
      `- ${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`,
    ];
    if (issue.question) lines.push(`  Ask: ${issue.question}`);
    if (issue.proposedValue !== undefined) lines.push(`  Proposed value: ${issue.proposedValue}`);
    if (issue.command) lines.push(`  Command: ${issue.command}`);
    return lines.join('\n');
  }).join('\n');
}

export function buildProjectConfigRemediationBlock(issues: ProjectConfigIssue[]): string {
  if (issues.length === 0) return '';

  return [
    '<slash_project_config_remediation>',
    'Priority: ZERO. Do not continue normal project work until these project.json issues are resolved or explicitly acknowledged by the user.',
    'On this turn, ask the user the listed questions immediately, then update .slash/project.json via `slash-ai config set` or a canonical project writer.',
    'Do not infer missing choices from static prompts or memory.',
    '',
    formatProjectConfigIssues(issues),
    '</slash_project_config_remediation>',
  ].join('\n');
}
