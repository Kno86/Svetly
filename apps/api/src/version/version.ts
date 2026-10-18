import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface VersionInfo {
  service: 'svetly-api';
  version: string;
  commit: string;
  builtAt: string;
}

function readPackageVersion(): string {
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'),
  ) as {
    version?: string;
  };
  return pkg.version ?? '0.0.0';
}

export function getVersionInfo(env: NodeJS.ProcessEnv = process.env): VersionInfo {
  return {
    service: 'svetly-api',
    version: readPackageVersion(),
    commit: env.GIT_SHA || 'unknown',
    builtAt: env.BUILD_TIME || 'unknown',
  };
}
