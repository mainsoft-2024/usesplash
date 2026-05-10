/**
 * Write content to stdout for the agent to consume.
 * This is the primary output mechanism — the agent reads CLI stdout.
 */
export function output(content: string): void {
  process.stdout.write(content);
}

/**
 * Write an error message to stderr (visible to agent but separate from content).
 */
export function error(message: string): void {
  process.stderr.write(`[slash-ai error] ${message}\n`);
}

/**
 * Resolver already returns lines starting with `[slash-ai error]`. Emit that line once,
 * then a structured self-heal block for agents (no duplicate prefix).
 */
export function resolverFailure(resolverMessage: string, selfHealBlock: string): void {
  const line = resolverMessage.endsWith('\n') ? resolverMessage : `${resolverMessage}\n`;
  process.stderr.write(line);
  process.stderr.write('\n');
  process.stderr.write(selfHealBlock);
  process.stderr.write('\n');
}

/**
 * Write an informational message to stderr.
 */
export function info(message: string): void {
  process.stderr.write(`[slash-ai] ${message}\n`);
}
