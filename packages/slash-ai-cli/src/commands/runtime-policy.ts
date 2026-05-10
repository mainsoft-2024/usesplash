import type { ProjectConfig } from '../schemas/project.js';
import { listUnsetWorkflowPreferences } from '../state/project-completeness.js';

function techPolicy(level: ProjectConfig['preferences']['techPreference']): string {
  switch (level) {
    case 'high':
      return 'The user is comfortable with technical detail and can be involved in framework, architecture, and tooling decisions.';
    case 'medium':
      return 'Use technical detail when it helps decisions, but summarize tradeoffs clearly and avoid unnecessary jargon.';
    case 'low':
      return 'Treat the user as mostly non-technical. Prefer product-level language, explain technical terms briefly, and make implementation decisions yourself unless they affect user-visible behavior or cost.';
    case 'none':
      return 'The user is a non-technical person. They do not want programming terms, frameworks, libraries, stack traces, or config-file details. Use simple everyday words, skip tech-related questions, and make safe product-oriented decisions yourself.';
  }
}

function questionPolicy(level: ProjectConfig['preferences']['questionLevel']): string {
  switch (level) {
    case 'high':
      return 'For large changes, ask 30-50 focused questions when needed to pin down requirements, constraints, UX, data, and architecture before execution.';
    case 'medium':
      return 'For ordinary non-trivial work, ask about 10-20 focused questions when decisions materially affect the result; otherwise proceed with explicit assumptions.';
    case 'low':
      return 'Ask 3-10 focused questions for meaningful ambiguity, then proceed with conservative defaults unless continuing would risk building the wrong thing.';
  }
}

function specDrivenBlock(specDriven: ProjectConfig['preferences']['specDriven']): string {
  if (specDriven === null) {
    return [
      'Spec-driven mode is UNSET (null) in project.json.',
      'Do not commit to OpenSpec vs non-OpenSpec work until the user sets preferences.specDriven to true or false via `slash-ai config set`.',
    ].join(' ');
  }
  if (specDriven) {
    return [
      'Spec-driven mode is ON.',
      'You may use OpenSpec: load slash-create-spec / slash-apply-spec when appropriate, use openspec-* skills, and read or update openspec/ as the skill playbooks require.',
    ].join(' ');
  }
  return [
    'Spec-driven mode is OFF.',
    'Do not use OpenSpec for work: do not load slash-create-spec, slash-apply-spec, or openspec-* skills. Ignore openspec/ (including any existing change proposals or tasks) as inputs for planning or implementation — treat the repo like a non-spec workflow.',
    'If the user explicitly asks to apply or author OpenSpec, reinterpret as ordinary implementation; suggest setting preferences.specDriven to true in .slash/project.json (slash-ai config) if they need full OpenSpec again.',
  ].join(' ');
}

function subagentPolicy(mode: ProjectConfig['preferences']['subagentMode']): string {
  if (mode === null) {
    return [
      'subagentMode is UNSET (null) in project.json.',
      'Do not assume standard vs parallel_preferred. Ask the user to set preferences.subagentMode to "standard" or "parallel_preferred" (`slash-ai config set preferences.subagentMode <value>`), or run `slash-ai project doctor` to see what is still unset.',
    ].join(' ');
  }
  switch (mode) {
    case 'standard':
      return [
        'Subagent mode is STANDARD.',
        'Subagents are part of normal operation; skip them only for narrow, low-risk work that is clearly local after brief direct orientation.',
        'Exploration: skip Explorer only when the answer is clearly localizable. If there is a first wrong lead, unclear ownership, broad search space, cross-module behavior, or likely hidden complexity, fire 1-2 Explorer agents.',
        'Implementation: skip Coder only when the edit is small, localized, low-risk, and not naturally parallel. If the work touches about 10+ files, has independent slices, needs separate verification/debugging, or would preserve main-agent context, use Coder subagents with explicit file allowlists.',
      ].join(' ');
    case 'parallel_preferred':
      return [
        'Subagent mode is PARALLEL_PREFERRED.',
        'Start exploration with 1-2 Explorer agents unless the request is trivial and already fully localized.',
        'Prefer Coder delegation for implementation unless the work is explicitly tiny or unsafe to split. Keep typical fanout to 1-3 Coders, and use phases only for clear dependency boundaries or collision avoidance.',
      ].join(' ');
  }
}

function tddPolicy(tdd: ProjectConfig['preferences']['tdd']): string {
  if (tdd === null) {
    return [
      'TDD is UNSET (null) in project.json.',
      'Do not fix a default (on vs off) until the user sets preferences.tdd to true or false via `slash-ai config set`.',
    ].join(' ');
  }
  if (tdd) {
    return 'TDD is ON. Write or update failing tests before implementation, then implement until those tests pass. Existing verification still applies.';
  }
  return 'TDD is OFF. Do not force tests-first before every change. Still add or update tests when risk, bugfix coverage, existing test patterns, or the user request warrants it, and always run applicable verification.';
}

function projectMetadataCompletionGuidance(config: ProjectConfig): string {
  const missing: string[] = [];
  if (config.app.framework == null) missing.push('app.framework');
  if (config.app.runtime == null) missing.push('app.runtime');
  const unsetWorkflow = listUnsetWorkflowPreferences(config);
  for (const p of unsetWorkflow) missing.push(p);

  if (missing.length === 0) {
    return 'Project metadata and workflow preferences are fully set; no init completion is required for those fields.';
  }
  return [
    `The following project.json fields are still null or unspecified: ${missing.join(', ')}.`,
    'Workflow tri-state: preferences.subagentMode, preferences.specDriven, preferences.tdd use JSON null until the user sets them — verify with `slash-ai project doctor` or `slash-ai project check --workflow`.',
    'For app fields, the orchestrator should help complete them: use ask_user_questions where Question Level allows, or direct the user to run slash-ai config set (e.g. app.framework, app.runtime).',
    'Respect Question Level: avoid unnecessary tech questions for low/none tech preference; still fill metadata when needed for correct builds.',
  ].join(' ');
}

export function buildRuntimePolicy(config: ProjectConfig): string {
  const lines = [
    '<slash_runtime_policy>',
    'Source: .slash/project.json validated and canonicalized by slash-ai.',
    `Platform: ${config.platform}`,
    `App Type: ${config.app.type}`,
    `Framework: ${config.app.framework ?? '(unspecified)'}`,
    `Runtime: ${config.app.runtime ?? '(unspecified)'}`,
    '',
    '## User Interaction Policy',
    `Tech Preference (${config.preferences.techPreference}): ${techPolicy(config.preferences.techPreference)}`,
    `Question Level (${config.preferences.questionLevel}): ${questionPolicy(config.preferences.questionLevel)}`,
    `Design Docs: ${config.preferences.designDocs ? 'Use design docs for material UI/UX work.' : 'Do not create design docs unless explicitly requested.'}`,
    '',
    '## Subagent Workflow',
    `subagentMode=${String(config.preferences.subagentMode)}. ${subagentPolicy(config.preferences.subagentMode)}`,
    'Researcher common rule: use or reuse Researcher whenever external docs, libraries, provider APIs, migration/version behavior, prior art, or best-practice uncertainty matters. This applies at session start and mid-conversation whenever new uncertainty appears.',
    'Explorer/Researcher are not one-time startup tools. Reuse them mid-conversation when new files, unclear ownership, external APIs, or unexpected failures appear.',
    '',
    '## Spec-driven workflow',
    `specDriven=${String(config.preferences.specDriven)}. ${specDrivenBlock(config.preferences.specDriven)}`,
    '',
    '## Test Workflow',
    `tdd=${String(config.preferences.tdd)}. ${tddPolicy(config.preferences.tdd)}`,
    '',
    '## Project metadata (post-init)',
    projectMetadataCompletionGuidance(config),
    '',
    '## Workflow Requirements',
    '- Do not infer the project.json shape from memory. Trust only this validated policy block and project metadata.',
    '- If project metadata changes, update .slash/project.json through slash-ai config or a canonical project writer.',
    '- If this policy conflicts with stale static prompt text, this runtime policy wins.',
    '</slash_runtime_policy>',
  ];

  return lines.join('\n');
}

export function buildProjectMetadata(config: ProjectConfig): string {
  const lines: string[] = [
    '<slash_project_context>',
    `Project ID: ${config.projectId ?? '(none)'}`,
    `Platform: ${config.platform}`,
    `App Type: ${config.app.type}`,
    `Framework: ${config.app.framework ?? '(unspecified)'}`,
    `Runtime: ${config.app.runtime ?? '(unspecified)'}`,
    `Tech Preference: ${config.preferences.techPreference}`,
    `Question Level: ${config.preferences.questionLevel}`,
    `Design Docs: ${config.preferences.designDocs}`,
    `Subagent Mode: ${config.preferences.subagentMode === null ? '(unset — set preferences.subagentMode)' : config.preferences.subagentMode}`,
    `Spec driven: ${config.preferences.specDriven === null ? '(unset — set preferences.specDriven)' : String(config.preferences.specDriven)}`,
    `TDD: ${config.preferences.tdd === null ? '(unset — set preferences.tdd)' : String(config.preferences.tdd)}`,
    `Deployment Provider: ${config.deployment.provider}`,
    `Deployment Status: ${config.deployment.status}`,
    `Deployment URL: ${config.deployment.url ?? '(none)'}`,
    `Last Deployed: ${config.deployment.lastDeployedAt ?? '(never)'}`,
  ];

  if (config.resources.length > 0) {
    lines.push('');
    lines.push('Provisioned Resources:');
    for (const r of config.resources) {
      lines.push(`  - ${r.id} (${r.kind}/${r.provider}): status=${r.status}, url_env=${r.connection.urlEnv}${r.connection.tokenEnv ? `, token_env=${r.connection.tokenEnv}` : ''}`);
    }
  }

  if (config.devServers.length > 0) {
    lines.push('');
    lines.push('Dev Servers:');
    for (const server of config.devServers) {
      lines.push(`  - ${server.id}: ${server.command} on port ${server.port}${server.cwd ? ` cwd=${server.cwd}` : ''}${server.primary ? ' primary=true' : ''}`);
    }
  }

  lines.push('');
  lines.push('IMPORTANT: When any of the above values change, update .slash/project.json immediately via `slash-ai config set` or a canonical project writer.');
  lines.push('</slash_project_context>');
  return lines.join('\n');
}
