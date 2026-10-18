export interface WebBuildInfo {
  version: string;
  commit: string;
  builtAt: string;
}

export function getWebBuildInfo(env: NodeJS.ProcessEnv = process.env): WebBuildInfo {
  return {
    version: env.SVETLY_WEB_VERSION || '0.1.0',
    commit: env.GIT_SHA || 'unknown',
    builtAt: env.BUILD_TIME || 'unknown',
  };
}
