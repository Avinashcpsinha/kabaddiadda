import Image from 'next/image';
import { KabaddiMatBg } from './kabaddi-mat-bg';

interface HeroSceneBgProps {
  src?: string;
  alt?: string;
}

/**
 * Hero backdrop — theme-split.
 *   Dark  : cinematic action photo (or crowd silhouette fallback) + heavy scrim.
 *   Light : clean perspective Kabaddi mat — no photo, premium editorial feel.
 *
 * Pass `src` to use a real photo in dark mode. Next.js Image handles
 * AVIF/WebP + responsive sizes automatically. When omitted, falls back to a
 * stylized 3-tier stadium crowd silhouette.
 */
export function HeroSceneBg({
  src,
  alt = 'Kabaddi action — players on the mat, fans in the stands',
}: HeroSceneBgProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* MOBILE (any theme) — clean perspective mat. The action photo is too
          busy on small screens (its built-in scoreboard graphic + sponsor
          banners fight the headline). Reserve photo for tablet+. */}
      <div className="md:hidden">
        <KabaddiMatBg />
      </div>

      {/* TABLET+ LIGHT — perspective mat */}
      <div className="hidden md:block dark:md:hidden">
        <KabaddiMatBg />
      </div>

      {/* TABLET+ DARK — cinematic photo + scrim */}
      <div className="hidden md:dark:block">
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_65%]"
          />
        ) : (
          <CrowdSilhouette />
        )}
        <div className="absolute inset-0 bg-background/35" />
        <div className="absolute inset-y-0 right-0 hidden w-1/5 bg-gradient-to-l from-background/60 to-transparent lg:block" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/55 to-transparent" />
      </div>
    </div>
  );
}

/**
 * Stylized 3-tier stadium crowd. Inline SVG, ~2KB. Each "person" = head ellipse
 * + shoulder ellipse. Closer tiers are larger (perspective).
 */
function CrowdSilhouette() {
  const tiers = [
    { y: 540, count: 26, scale: 0.7, opacity: 0.35 },
    { y: 660, count: 22, scale: 0.9, opacity: 0.6 },
    { y: 800, count: 18, scale: 1.1, opacity: 0.95 },
  ];
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      className="h-full w-full text-primary/25"
    >
      {/* Stadium rim glow line */}
      <path
        d="M 0 460 Q 800 440 1600 460"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.4"
      />

      {tiers.map((t, ti) => {
        const xStep = 1600 / t.count;
        return (
          <g key={ti} fill="currentColor" opacity={t.opacity}>
            {Array.from({ length: t.count }).map((_, i) => {
              const x = xStep * (i + 0.5) + (ti % 2 === 0 ? 12 : 0); // stagger rows
              return (
                <g key={i}>
                  <ellipse cx={x} cy={t.y - 20 * t.scale} rx={12 * t.scale} ry={14 * t.scale} />
                  <ellipse cx={x} cy={t.y + 8 * t.scale} rx={22 * t.scale} ry={20 * t.scale} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
