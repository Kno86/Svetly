import { fetchApiStatus, type ApiStatus } from '../lib/api-status';
import { getWebBuildInfo } from '../lib/build-info';

export const dynamic = 'force-dynamic';

function describeApi(status: ApiStatus): string {
  switch (status.state) {
    case 'ready':
      return `готов (версия ${status.version}, сборка ${status.builtAt})`;
    case 'not-ready':
      return `не готов (HTTP ${status.httpStatus})`;
    case 'unreachable':
      return 'недоступен';
  }
}

export default async function HomePage() {
  const build = getWebBuildInfo();
  const api = await fetchApiStatus(process.env.API_INTERNAL_URL ?? 'http://api:4000');

  return (
    <main>
      <h1>SVETLY</h1>
      <p>
        Технический фундамент проекта (PHASE 1). Публичные разделы появятся в следующих утверждённых
        фазах.
      </p>
      <dl>
        <dt>Web</dt>
        <dd data-testid="web-version">
          версия {build.version}, коммит {build.commit}, сборка {build.builtAt}
        </dd>
        <dt>API</dt>
        <dd data-testid="api-status">{describeApi(api)}</dd>
      </dl>
    </main>
  );
}
