import { useId } from 'react';
import { MARK, WORDMARK } from './logo-geometry';

type Variant = 'color' | 'on-dark' | 'mono' | 'inverse';

const BRAND = {
  deep: '#103C2F',
  forest: '#245844',
  leaf: '#7D9D58',
  gold: '#E9BC66',
  ivory: '#F7F6F0',
  forestDark: '#1B4A39',
};

function MarkShapes({ variant, id }: { variant: Variant; id: string }) {
  if (variant === 'mono' || variant === 'inverse') {
    const color = variant === 'mono' ? BRAND.deep : BRAND.ivory;
    return (
      <>
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
            <rect width="64" height="64" rx={MARK.radius} fill="#fff" />
            <circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill="#000" />
            <path d={MARK.trees} fill="#000" />
            <path d={MARK.house} fill="#000" />
            <path d={MARK.road} fill="#000" />
          </mask>
        </defs>
        <rect width="64" height="64" rx={MARK.radius} fill={color} mask={`url(#${id})`} />
      </>
    );
  }
  return (
    <>
      <defs>
        <clipPath id={id}>
          <rect width="64" height="64" rx={MARK.radius} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {/* On dark surfaces the badge is lifted to Forest so its silhouette stays visible. */}
        <rect width="64" height="64" fill={variant === 'on-dark' ? BRAND.forest : BRAND.deep} />
        <circle cx={MARK.sun.cx} cy={MARK.sun.cy} r={MARK.sun.r} fill={BRAND.gold} />
        <path d={MARK.hill} fill={variant === 'on-dark' ? BRAND.forestDark : BRAND.forest} />
        <path d={MARK.trees} fill={BRAND.leaf} />
        <path d={MARK.house} fill={BRAND.ivory} />
        <path d={MARK.road} fill={BRAND.ivory} />
      </g>
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
  const wordColor = variant === 'color' || variant === 'mono' ? BRAND.deep : BRAND.ivory;
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
