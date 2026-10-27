'use client';

import { useEffect, useId, useState } from 'react';
import { TextField } from '../ui/Field';
import { apiRequest } from '../../lib/auth-client';

/** Search input with title suggestions (native datalist) fetched after a short pause in typing. */
export function SearchField({ defaultValue }: { defaultValue: string }) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      void apiRequest<{ items: Array<{ title: string }> }>(
        `/api/search/suggest?q=${encodeURIComponent(q)}`,
      ).then((r) =>
        setOptions(r.ok && r.data ? [...new Set(r.data.items.map((i) => i.title))] : []),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <>
      <TextField
        label="Что ищем"
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        minLength={2}
        maxLength={200}
        required
        list={listId}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
