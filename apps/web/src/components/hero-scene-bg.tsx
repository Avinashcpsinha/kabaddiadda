import Image from 'next/image';

interface HeroSceneBgProps {
  src?: string;
  alt?: string;
}

/**
 * Hero backdrop. Pass `src` to use a real photo (Next.js Image handles
 * AVIF/WebP + responsive sizes automatically). When omitted, falls back to a
 * stylized 3-tier stadium crowd silhouette so the empty state still reads as
 * a sport scene.
 */
export function HeroSceneBg({
  src,
  alt = 'Kabaddi action — players on the mat, fans in the stands',
}: HeroSceneBgProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
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

      {/* Adaptive scrim — keeps headline + scoreboard legible in BOTH themes.
          Light theme: heavy white wash so the warm photo doesn't muddy black text.
          Dark theme:  lighter wash so the action shows through richly.        */}
      <div className="absolute inset-0 bg-background/78 dark:bg-background/35" />
      {/* Subtle right-corner fade — kept narrow so the raiders show through */}
      <div className="absolute inset-y-0 right-0 hidden w-1/5 bg-gradient-to-l from-background/60 to-transparent lg:block" />
      {/* Bottom vignette so stat counters + buttons sit on solid ground */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/55 to-transparent" />
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
