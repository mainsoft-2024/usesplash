/**
 * Stderr blocks for agents when instruction/context resolution fails.
 * Keep these imperative and copy-pasteable (env vars, file paths, commands).
 */

export function selfHealInstructionFetch(packName: string): string {
  return [
    '<slash_ai_cli_self_heal>',
    'AI agent: fix the failure above, then re-run the same slash-ai command. Work through steps in order.',
    '',
    `## Instruction pack "${packName}" could not be loaded`,
    '',
    '### 1. Remote API (default)',
    '- Ensure `SLASH_AI_API_KEY` is set in the **same shell** that runs `slash-ai` (Cursor terminal, CI env, etc.).',
    '- Optional: `SLASH_API_URL` overrides the API base (default `https://slash.ai.kr/api/cli`).',
    '- After setting the key: run `slash-ai start` again.',
    '',
    '### 2. Local content directory (dev / air-gapped)',
    `- Set \`SLASH_CONTENT_DIR\` to the directory that contains \`instructions/${packName}.md\`.`,
    `- Quick check: \`test -f "$SLASH_CONTENT_DIR/instructions/${packName}.md"\` must exit 0.`,
    '- Then re-run `slash-ai start`.',
    '',
    '### 3. Project layout',
    '- From the **repository root**: run `slash-ai init` if `.slash/` or `.slash/project.json` is missing.',
    '- Run `slash-ai project doctor` and resolve CRITICAL lines (often `slash-ai config set app.framework …` and `app.runtime …`).',
    '',
    '### 4. Network',
    '- Resolution uses HTTP fetch with a 10s timeout. Retry if the host was temporarily unreachable.',
    '</slash_ai_cli_self_heal>',
  ].join('\n');
}

export function selfHealContextFetch(contextName: string): string {
  return [
    '<slash_ai_cli_self_heal>',
    `## Context "${contextName}" could not be loaded`,
    '',
    `Same remediation as instruction packs: set \`SLASH_AI_API_KEY\` **or** \`SLASH_CONTENT_DIR\` so that \`context/${contextName}.md\` exists under that directory.`,
    'Then re-run `slash-ai start`.',
    '</slash_ai_cli_self_heal>',
  ].join('\n');
}
