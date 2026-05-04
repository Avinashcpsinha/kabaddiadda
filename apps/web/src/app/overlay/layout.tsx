/**
 * Overlay layout — transparent body for OBS / Streamyard browser-source use.
 *
 * The root layout sets `bg-background` on <body>, which would render an opaque
 * background under the strip. Producers expect transparent canvas around the
 * graphic so they can chroma-key or composite directly. We override here.
 */
export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`html, body { background: transparent !important; }`}</style>
      {children}
    </>
  );
}
