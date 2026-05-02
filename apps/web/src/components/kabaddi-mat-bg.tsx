/**
 * Kabaddi mat — laid as a perspective floor behind the hero.
 * Inline SVG (~500 bytes), no network request, themes via currentColor.
 *
 * Lines drawn (real Kabaddi mat geometry):
 *   - Outer boundary
 *   - Mid line (vertical centre)
 *   - Baulk lines (parallel to mid, both sides)
 *   - Bonus lines (further out, both sides)
 *   - Lobby boundary (top + bottom horizontal)
 */
export function KabaddiMatBg({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="absolute inset-x-0 bottom-0 h-[120%] [perspective:1400px]">
        <div className="h-full w-full origin-bottom [transform:rotateX(62deg)]">
          <svg
            viewBox="0 0 1300 1000"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMax slice"
            className="h-full w-full text-primary/35 dark:text-primary/25"
          >
            {/* Outer boundary */}
            <rect
              x="50"
              y="50"
              width="1200"
              height="900"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            {/* Mid line */}
            <line x1="650" y1="50" x2="650" y2="950" stroke="currentColor" strokeWidth="2" />
            {/* Baulk lines */}
            <line
              x1="370"
              y1="50"
              x2="370"
              y2="950"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="14 6"
            />
            <line
              x1="930"
              y1="50"
              x2="930"
              y2="950"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="14 6"
            />
            {/* Bonus lines */}
            <line
              x1="200"
              y1="50"
              x2="200"
              y2="950"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
            <line
              x1="1100"
              y1="50"
              x2="1100"
              y2="950"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
            {/* Lobby boundaries */}
            <line x1="50" y1="200" x2="1250" y2="200" stroke="currentColor" strokeWidth="1.5" />
            <line x1="50" y1="800" x2="1250" y2="800" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
      {/* Fade the mat into the page at the top + sides — keeps headline crisp */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-background/40 to-background" />
    </div>
  );
}
