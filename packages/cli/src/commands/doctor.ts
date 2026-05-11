import type { Command } from 'commander';
import chalk from 'chalk';
import { output } from '../utils/output';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Diagnose Paracosm installation and configuration')
    .action(async () => {
      output.print(chalk.bold('Paracosm Doctor'));
      output.print(chalk.gray('Running diagnostics...\n'));

      const checks: CheckResult[] = [];

      checks.push(checkNodeVersion());
      checks.push(checkConfigFile());
      checks.push(await checkServerConnection());
      checks.push(await checkApiEndpoints());
      checks.push(checkEnvironmentVars());

      let allOk = true;
      for (const check of checks) {
        const icon =
          check.status === 'ok' ? chalk.green('[OK]') :
          check.status === 'warn' ? chalk.yellow('[WARN]') :
          chalk.red('[FAIL]');

        output.print(`  ${icon} ${chalk.bold(check.name)}: ${check.message}`);

        if (check.status !== 'ok') allOk = false;
      }

      output.print('');
      if (allOk) {
        output.success('All checks passed');
      } else {
        output.warn('Some checks failed. Review the output above.');
        process.exit(1);
      }
    });
}

function checkNodeVersion(): CheckResult {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major >= 20) {
    return { name: 'Node.js', status: 'ok', message: `v${version.slice(1)} detected` };
  }
  return { name: 'Node.js', status: 'fail', message: `v${version.slice(1)} detected (requires >= 20.0.0)` };
}

function checkConfigFile(): CheckResult {
  const configPath = process.env.PARACOSM_CONFIG ?? `${process.env.HOME ?? '~'}/.paracosm/config.json`;

  try {
    const fs = require('fs');
    if (fs.existsSync(configPath)) {
      return { name: 'Config', status: 'ok', message: `Found at ${configPath}` };
    }
    return { name: 'Config', status: 'warn', message: `Not found at ${configPath}. Run 'paracosm config init'` };
  } catch {
    return { name: 'Config', status: 'warn', message: 'Unable to check config file' };
  }
}

async function checkServerConnection(): Promise<CheckResult> {
  try {
    const res = await fetch('http://localhost:7529/api/v1/heartbeat', {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      return { name: 'Server', status: 'ok', message: 'Running on port 7529' };
    }
    return { name: 'Server', status: 'warn', message: `Responded with status ${res.status}` };
  } catch {
    return { name: 'Server', status: 'fail', message: 'Not reachable on port 7529' };
  }
}

async function checkApiEndpoints(): Promise<CheckResult> {
  try {
    const res = await fetch('http://localhost:7529/api/v1/chat', {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok || res.status === 204 || res.status === 405) {
      return { name: 'API', status: 'ok', message: 'Endpoints accessible' };
    }
    return { name: 'API', status: 'warn', message: `Unexpected status ${res.status}` };
  } catch {
    return { name: 'API', status: 'fail', message: 'Cannot reach API endpoints' };
  }
}

function checkEnvironmentVars(): CheckResult {
  const vars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
  const found = vars.filter((v) => process.env[v]);

  if (found.length > 0) {
    return { name: 'API Keys', status: 'ok', message: `${found.length} key(s) configured (${found.join(', ')})` };
  }
  return { name: 'API Keys', status: 'warn', message: 'No API keys found in environment' };
}
