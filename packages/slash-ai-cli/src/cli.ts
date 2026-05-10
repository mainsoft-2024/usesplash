#!/usr/bin/env node

import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { instructionCommand } from './commands/instruction.js';
import {
  projectCheck,
  projectDoctor,
  projectMigrate,
  projectSchema,
  projectStatus,
  projectTemplate,
} from './commands/project.js';
import { configGet, configSet } from './commands/config.js';
import { contentUpdate, contentLs, contentRollback } from './commands/content.js';
import { infraProvisionDb, infraList, infraReconcile } from './commands/infra.js';
import { deployCheck } from './commands/deploy.js';
import { getVersion } from './utils/version.js';

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

async function main(): Promise<void> {
  switch (command) {
    case 'init':
      initCommand();
      break;

    case 'start':
      await startCommand();
      break;

    case 'instruction':
      if (!subcommand) {
        process.stderr.write('Usage: slash-ai instruction <name>\n');
        process.stderr.write(
          'Available: start, implementation, exploration, create-spec, apply-spec, nonspec, ui-design, verification, escalation\n',
        );
        process.exit(1);
      }
      await instructionCommand(subcommand);
      break;

    case 'project':
      await handleProject(subcommand);
      break;

    case 'config':
      await handleConfig(subcommand, args[2], args[3]);
      break;

    case 'content':
      await handleContent(subcommand);
      break;

    case 'infra':
      await handleInfra(subcommand, args.slice(2));
      break;

    case 'deploy':
      await handleDeploy(subcommand);
      break;

    case '--version':
    case '-v':
      process.stdout.write(`${getVersion()}\n`);
      break;

    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;

    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  process.stdout.write(`
slash-ai — S/ASH AI agent runtime instruction delivery CLI

Usage: slash-ai <command> [options]

Instructions (pure context delivery):
  init                    Initialize .slash/ project structure
  start                   Load intent gate + delegation + project context
  instruction <name>      Load on-demand instruction pack

Project Management:
  project status          Show project state
  project doctor          Validate project health
  project migrate        Migrate project.json to latest schema
  project check [--strict] [--workflow]  Validate project.json; --workflow requires workflow prefs non-null
  project schema         Print project JSON Schema
  project template       Print canonical project.json template

  config get <path>       Read project.json value
  config set <path> <val> Update project.json value

Infrastructure:
  infra provision db      Provision Turso SQLite database
  infra list              List managed resources

Deploy:
  deploy check            Validate deployment readiness

Content:
  content update          Force refresh content cache
  content ls              List cached content packs

Options:
  --version, -v           Show version
  --help, -h              Show this help
`);
}

async function handleProject(sub: string | undefined): Promise<void> {
  switch (sub) {
    case 'status': case undefined: await projectStatus(); break;
    case 'doctor': await projectDoctor(); break;
    case 'migrate': await projectMigrate(); break;
    case 'check':
      await projectCheck(
        process.argv.includes('--strict'),
        process.argv.includes('--workflow'),
      );
      break;
    case 'schema': await projectSchema(); break;
    case 'template': await projectTemplate(); break;
    default: process.stderr.write(`Unknown project command: ${sub}\n`); process.exit(1);
  }
}

async function handleConfig(sub: string | undefined, path?: string, value?: string): Promise<void> {
  switch (sub) {
    case 'get': if (!path) { process.stderr.write('Usage: slash-ai config get <path>\n'); process.exit(1); } await configGet(path); break;
    case 'set': if (!path || value === undefined) { process.stderr.write('Usage: slash-ai config set <path> <value>\n'); process.exit(1); } await configSet(path, value); break;
    default: process.stderr.write(`Usage: slash-ai config get|set\n`); process.exit(1);
  }
}

async function handleContent(sub: string | undefined): Promise<void> {
  switch (sub) {
    case 'update': await contentUpdate(); break;
    case 'ls': await contentLs(); break;
    case 'rollback': await contentRollback(process.argv[4] ?? ''); break;
    default: process.stderr.write('Usage: slash-ai content update|ls|rollback\n'); process.exit(1);
  }
}

async function handleInfra(sub: string | undefined, extraArgs: string[]): Promise<void> {
  switch (sub) {
    case 'provision':
      if (extraArgs[0] === 'db') await infraProvisionDb();
      else { process.stderr.write('Usage: slash-ai infra provision db\n'); process.exit(1); }
      break;
    case 'list': await infraList(); break;
    case 'reconcile': await infraReconcile(); break;
    default: process.stderr.write('Usage: slash-ai infra provision|list|reconcile\n'); process.exit(1);
  }
}

async function handleDeploy(sub: string | undefined): Promise<void> {
  switch (sub) {
    case 'check': await deployCheck(); break;
    default: process.stderr.write('Usage: slash-ai deploy check\n'); process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`[slash-ai fatal] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
