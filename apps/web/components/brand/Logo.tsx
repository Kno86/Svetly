import { useId } from 'react';
import { MARK, WORDMARK } from './logo-geometry';

type Variant = 'color' | 'on-dark' | 'mono' | 'inverse';

const BRAND = {
  ink: '#24201C',
  primary: '#B4441E',
  sun: '#F2B441',
  paper: '#FAF6EF',
};

function Lines({ fill, fade }: { fill: string; fade: boolean }) {
  return (
    <>
      {MARK.lines.map((l) => (
        <rect
          key={l.y}
          x={l.x}
          y={l.y}
          width={l.w}
          height={l.h}
          rx={l.h / 2}
          fill={fill}
          opacity={fade ? l.o : undefined}
        />
      ))}
    </>
  );
}

function MarkShapes({ variant, id }: { variant: Variant; id: string }) {
  if (variant === 'mono' || variant === 'inverse') {
    const color = variant === 'mono' ? BRAND.ink : BRAND.paper;
    return (
      <>
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
            <rect width="64" height="64" rx={MARK.radius} fill="#fff" />
            <path d={MARK.sun} fill="#000" />
            <Lines fill="#000" fade={false} />
          </mask>
        </defs>
        <rect width="64" height="64" rx={MARK.radius} fill={color} mask={`url(#${id})`} />
      </>
    );
  }
  return (
    <>
      <rect width="64" height="64" rx={MARK.radius} fill={BRAND.primary} />
      <path d={MARK.sun} fill={BRAND.sun} />
      <Lines fill={BRAND.paper} fade />
    </>
  );
}

export interface LogoProps {
  variant?: Variant;
  /** Rendered height in px. */
  height?: number;
  /** `mark` renders only the symbol (app mark), without the wordmark. */
  layout?: 'horizontal' | 'mark';
  className?: string;
  title?: string;
}

export function Logo({
  variant = 'color',
  height = 40,
  layout = 'horizontal',
  className,
  title = 'SVETLY',
}: LogoProps) {
  const id = useId().replace(/:/g, '');
  const width = layout === 'mark' ? 64 : 64 + WORDMARK.gap + WORDMARK.width;
  const wordColor = variant === 'color' || variant === 'mono' ? BRAND.ink : BRAND.paper;
  return (
    <svg
      viewBox={`0 0 ${width} 64`}
      height={height}
      width={(height * width) / 64}
      role="img"
      aria-label={title}
      className={className}
    >
      <MarkShapes variant={variant} id={`logo-${id}`} />
      {layout === 'horizontal' && (
        <path
          transform={`translate(${64 + WORDMARK.gap} ${32 + WORDMARK.capHeight / 2})`}
          d={WORDMARK.d}
          fill={wordColor}
        />
      )}
    </svg>
  );
}
