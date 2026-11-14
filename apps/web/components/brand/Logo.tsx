import { useId } from 'react';
import { MARK, WORDMARK } from './logo-geometry';

type Variant = 'color' | 'on-dark' | 'mono' | 'inverse';

const BRAND = {
  ink: '#24201C',
  primary: '#B4441E',
  sun: '#F2B441',
  paper: '#FAF6EF',
};

function Symbol({ color }: { color: string }) {
  return (
    <>
      <path
        d={MARK.road}
        fill="none"
        stroke={color}
        strokeWidth={MARK.stroke}
        strokeLinecap="round"
      />
      <circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill={color} />
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
            <Symbol color="#000" />
          </mask>
        </defs>
        <rect width="64" height="64" rx={MARK.radius} fill={color} mask={`url(#${id})`} />
      </>
    );
  }
  return (
    <>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={MARK.gradient.top} />
          <stop offset="1" stopColor={MARK.gradient.bottom} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx={MARK.radius} fill={`url(#${id}-g)`} />
      <path
        d={MARK.road}
        fill="none"
        stroke={BRAND.paper}
        strokeWidth={MARK.stroke}
        strokeLinecap="round"
      />
      <circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill={BRAND.sun} />
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
  const wordColor =
    variant === 'color'
      ? `var(--color-ink, ${BRAND.ink})`
      : variant === 'mono'
        ? BRAND.ink
        : BRAND.paper;
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
