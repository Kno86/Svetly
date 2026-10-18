import { getWebBuildInfo } from '../../lib/build-info';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json(
    { status: 'ok', service: 'svetly-web', ...getWebBuildInfo() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
