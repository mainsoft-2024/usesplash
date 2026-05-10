import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const ResourceConnectionSchema = z.object({
  urlEnv: z.string(),
  tokenEnv: z.string().nullable().default(null),
}).strict();

export const ResourceSchema = z.object({
  id: z.string(),
  kind: z.enum(['database', 'storage', 'api-key']),
  role: z.string().nullable().default(null),
  provider: z.string(),
  externalId: z.string().nullable().default(null),
  status: z.enum(['provisioning', 'ready', 'error', 'deleted']),
  connection: ResourceConnectionSchema,
  metadata: z.record(z.string()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const DeploymentSchema = z.object({
  provider: z.enum(['coolify', 'vercel', 'none']).default('none'),
  status: z.enum(['not_deployed', 'deployed', 'deploying', 'failed']).default('not_deployed'),
  url: z.string().nullable().default(null),
  lastDeployedAt: z.string().nullable().default(null),
}).strict();

/** `null` means the value is explicitly unset — use `slash-ai config set` or project doctor; do not infer a default. */
export const SubagentModePreferenceSchema = z
  .union([z.enum(['standard', 'parallel_preferred']), z.null()])
  .describe('null = user has not chosen yet');

export const PreferencesSchema = z.object({
  techPreference: z.enum(['high', 'medium', 'low', 'none']).default('none'),
  questionLevel: z.enum(['high', 'medium', 'low']).default('medium'),
  designDocs: z.boolean().default(true),
  subagentMode: SubagentModePreferenceSchema,
  /** When true, OpenSpec workflows and openspec/ are in play; when false, ignore them; when null, unset. */
  specDriven: z.union([z.boolean(), z.null()]),
  tdd: z.union([z.boolean(), z.null()]),
}).strict();

export const AppSchema = z.object({
  type: z.enum(['webapp', 'mobileapp', 'desktopapp', 'library', 'api']).default('webapp'),
  framework: z.string().nullable().default(null),
  runtime: z.string().nullable().default(null),
}).strict();

export const DevServerSchema = z.object({
  id: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/, 'id must be kebab-case, 1-32 chars'),
  name: z.string(),
  command: z.string(),
  port: z.number(),
  cwd: z.string().nullable().default(null),
  stopCommand: z.string().nullable().default(null),
  primary: z.boolean().default(false),
}).strict();

export const ProjectConfigSchema = z.object({
  schemaVersion: z.literal('1.1.0').default('1.1.0'),
  projectId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  platform: z.enum(['cloud', 'local']),
  app: AppSchema.default({}),
  /** Always materialized in project.json; workflow fields use JSON null until the user sets them. */
  preferences: PreferencesSchema,
  deployment: DeploymentSchema.default({}),
  resources: z.array(ResourceSchema).default([]),
  devServers: z.array(DevServerSchema).default([]),
}).strict();

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type Deployment = z.infer<typeof DeploymentSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;

export function getProjectConfigJsonSchema(): unknown {
  return zodToJsonSchema(ProjectConfigSchema, {
    name: 'SlashProjectConfig',
    $refStrategy: 'none',
  });
}
