'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import css from './pwa.module.css';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

/** Registers `/sw.js`, offers a reload when a new version is waiting, shows network state. */
export function ServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [offline, setOffline] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (!navigator.onLine) onOffline();

    let reloading = false;
    const sw = navigator.serviceWorker;
    const onChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible')
        void sw?.getRegistration().then((r) => r?.update());
    };
    if (sw && process.env.NODE_ENV === 'production') {
      void sw.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((reg) => {
        if (reg.waiting && sw.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed' && sw.controller) setWaiting(next);
          });
        });
      });
      sw.addEventListener('controllerchange', onChange);
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      sw?.removeEventListener('controllerchange', onChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!waiting && !offline && !install) return null;
  return (
    <div className={css.bar} role="status">
      {offline && <span>Нет подключения к интернету. Данные могут быть неактуальны.</span>}
      {waiting && (
        <>
          <span>Доступна новая версия SVETLY.</span>
          <Button size="sm" onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}>
            Обновить
          </Button>
        </>
      )}
      {install && !waiting && !offline && (
        <>
          <span>SVETLY можно установить как приложение.</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void install.prompt();
              setInstall(null);
            }}
          >
            Установить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setInstall(null)}>
            Не сейчас
          </Button>
        </>
      )}
    </div>
  );
}
