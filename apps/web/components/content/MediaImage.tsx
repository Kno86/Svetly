import Image from 'next/image';

/**
 * Public uploaded photo served through the Next.js image optimizer (resized AVIF/WebP per screen).
 * Not for private message attachments: the optimizer fetches without the viewer's cookies.
 */
const VARIANTS = {
  gallery: { width: 1200, height: 900, sizes: '(max-width: 640px) 50vw, 20rem' },
  cover: { width: 1600, height: 900, sizes: '(max-width: 960px) 100vw, 60rem' },
  post: { width: 1200, height: 900, sizes: '(max-width: 640px) 100vw, 36rem' },
  card: {
    width: 800,
    height: 600,
    sizes: '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 20rem',
  },
  thumb: { width: 320, height: 320, sizes: '6rem' },
  photo: { width: 1600, height: 1200, sizes: '(max-width: 800px) 100vw, 46rem' },
} as const;

export function MediaImage({
  id,
  alt,
  variant,
  className,
  eager = false,
}: {
  id: string;
  alt: string;
  variant: keyof typeof VARIANTS;
  className?: string;
  eager?: boolean;
}) {
  const v = VARIANTS[variant];
  return (
    <Image
      src={`/api/media/${id}`}
      alt={alt}
      width={v.width}
      height={v.height}
      sizes={v.sizes}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
    />
  );
}
