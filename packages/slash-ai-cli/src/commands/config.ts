import { readProjectConfig, writeProjectConfig } from '../state/project.js';
import { ProjectConfigSchema } from '../schemas/project.js';
import { output, error } from '../utils/output.js';

export async function configGet(path: string): Promise<void> {
  const config = readProjectConfig();
  if (!config) {
    error('.slash/project.json not found.');
    process.exit(1);
  }

  const value = getNestedValue(config, path);
  if (value === undefined) {
    error(`Key "${path}" not found in project.json`);
    process.exit(1);
  }

  output(typeof value === 'object' ? JSON.stringify(value, null, 2) + '\n' : String(value) + '\n');
}

export async function configSet(path: string, rawValue: string): Promise<void> {
  const config = readProjectConfig();
  if (!config) {
    error('.slash/project.json not found.');
    process.exit(1);
  }

  // Auto-parse value types
  let value: unknown = rawValue;
  if (rawValue === 'true') value = true;
  else if (rawValue === 'false') value = false;
  else if (rawValue === 'null') value = null;
  else if (/^\d+$/.test(rawValue)) value = Number(rawValue);

  const updated = setNestedValue({ ...config }, path, value);
  updated.updatedAt = new Date().toISOString();

  // Validate before writing
  const result = ProjectConfigSchema.safeParse(updated);
  if (!result.success) {
    error(
      `Validation failed: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
    );
    process.exit(1);
  }

  writeProjectConfig(result.data);
  output(`✓ Set ${path} = ${JSON.stringify(value)}\n`);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}
