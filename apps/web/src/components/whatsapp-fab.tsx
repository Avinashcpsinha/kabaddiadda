'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Phone, X } from 'lucide-react';

/**
 * Floating contact pill — WhatsApp + phone call. Sits above the Feedback
 * widget in the bottom-right corner. Visible on every public + organiser
 * page; hidden on /admin/* to match the FeedbackWidget visibility rule
 * (the team doesn't need to contact themselves from their own console).
 *
 * On click it opens a small popover with two actions. Closing happens on
 * outside click, escape, or selecting an action.
 */

const WHATSAPP_NUMBER_WAME = '918743071145'; // wa.me path format — no +, no dashes
const PHONE_TEL = '+918743071145';
const PHONE_DISPLAY = '+91 87430 71145';
const WHATSAPP_DEFAULT_MESSAGE = "Hi Kabaddiadda! I'd like to know more.";

export function WhatsAppFab() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Hide on admin routes (matches FeedbackWidget behaviour).
  if (pathname?.startsWith('/admin')) return null;

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER_WAME}?text=${encodeURIComponent(
    WHATSAPP_DEFAULT_MESSAGE,
  )}`;

  return (
    <>
      {/* Click-outside catcher. Sits below the FAB stack in z-order. */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed bottom-20 right-5 z-40 sm:bottom-24">
        {open && (
          <div className="absolute bottom-full right-0 mb-3 w-64 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-2xl">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <WhatsAppIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 text-left">
                <div className="text-sm font-semibold">Chat on WhatsApp</div>
                <div className="truncate text-xs text-muted-foreground">{PHONE_DISPLAY}</div>
              </div>
            </a>
            <a
              href={`tel:${PHONE_TEL}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-500">
                <Phone className="h-5 w-5" />
              </span>
              <div className="min-w-0 text-left">
                <div className="text-sm font-semibold">Call us</div>
                <div className="truncate text-xs text-muted-foreground">{PHONE_DISPLAY}</div>
              </div>
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close contact menu' : 'Contact us on WhatsApp or phone'}
          aria-expanded={open}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 ring-1 ring-white/20 transition hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          {/* Idle attention pulse — hidden once opened to avoid distracting the menu. */}
          {!open && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-emerald-500 opacity-50 motion-safe:animate-ping"
            />
          )}
          <span className="relative">
            {open ? <X className="h-6 w-6" /> : <WhatsAppIcon className="h-7 w-7" />}
          </span>
        </button>
      </div>
    </>
  );
}

/**
 * Inline WhatsApp glyph. Path data from the WhatsApp brand asset (single colour,
 * `currentColor` so the parent's `text-*` decides the fill). Bundled inline to
 * avoid adding a brand-icon dependency and to keep the glyph crisp at any size.
 */
function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  );
}
