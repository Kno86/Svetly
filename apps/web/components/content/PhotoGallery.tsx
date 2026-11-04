'use client';

import { useState } from 'react';
import { MediaImage } from './MediaImage';
import styles from './content.module.css';

/** Whole photo is shown (no cropping); thumbnails switch it, the large photo opens the original. */
export function PhotoGallery({ ids, title }: { ids: string[]; title: string }) {
  const [current, setCurrent] = useState(0);
  if (ids.length === 0) return null;
  const id = ids[Math.min(current, ids.length - 1)]!;
  return (
    <div>
      <a
        href={`/api/media/${id}`}
        target="_blank"
        rel="noopener"
        className={styles.photoMain}
        aria-label={`Открыть фото ${current + 1} в полном размере`}
      >
        <MediaImage
          id={id}
          alt={`${title} — фото ${current + 1} из ${ids.length}`}
          variant="photo"
          eager
        />
      </a>
      {ids.length > 1 && (
        <div className={styles.thumbs} role="group" aria-label="Все фото">
          {ids.map((t, i) => (
            <button
              key={t}
              type="button"
              aria-label={`Фото ${i + 1}`}
              aria-pressed={i === current}
              onClick={() => setCurrent(i)}
            >
              <MediaImage id={t} alt="" variant="thumb" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
