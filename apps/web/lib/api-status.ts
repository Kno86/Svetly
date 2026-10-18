export type ApiStatus =
  | { state: 'ready'; version: string; builtAt: string }
  | { state: 'not-ready'; httpStatus: number }
  | { state: 'unreachable' };

interface ReadyBody {
  status?: string;
}

interface VersionBody {
  version?: string;
  builtAt?: string;
}

export async function fetchApiStatus(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2000,
): Promise<ApiStatus> {
  try {
    const ready = await fetchImpl(`${baseUrl}/api/health/ready`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await ready.json().catch(() => ({}))) as ReadyBody;
    if (!ready.ok || body.status !== 'ok') {
      return { state: 'not-ready', httpStatus: ready.status };
    }
    const versionRes = await fetchImpl(`${baseUrl}/api/version`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const version = (await versionRes.json().catch(() => ({}))) as VersionBody;
    return {
      state: 'ready',
      version: version.version ?? 'unknown',
      builtAt: version.builtAt ?? 'unknown',
    };
  } catch {
    return { state: 'unreachable' };
  }
}
