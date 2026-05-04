'use client';

import * as React from 'react';
import { Check, Copy, Tv } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Collapsible "Share with broadcaster" panel rendered below the match
 * action buttons. Builds the absolute overlay URL on the client (so the
 * domain is correct in dev / staging / prod without an env-var round-trip)
 * and produces a single share-text the operator can paste to their producer.
 */
export function BroadcastOverlayHelp({ matchId }: { matchId: string }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/overlay/match/${matchId}` : '';
  const previewUrl = url ? `${url}?preview=1` : '';
  const shareText = `Live scoreboard overlay for the match.

URL: ${url}

OBS / Streamyard / Restream / vMix — add this URL as a Browser Source:
  • Width:  1920
  • Height: 240
  • Tick "Refresh browser when scene becomes active"
  • Place at the bottom of your scene (no other CSS needed — canvas is transparent)

What it shows
  • Home + away score, half + clock
  • Live raid timer + current raider name during a raid
  • Auto Do-or-Die badge (when a team has 2 empty raids in a row)
  • Auto All-out +2 flash for 5 seconds when a side gets wiped
  • Updates in real time as the operator scores the match — no polling, no refresh.`;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success('Share text copied — paste it to your broadcaster.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy. Select the text and copy manually.');
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Tv className="h-3 w-3" />
        {open ? 'Hide broadcaster instructions' : 'Share overlay with broadcaster'}
      </button>
      {open && (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Send this to your producer
            </h3>
            <Button size="sm" variant="outline" onClick={copyToClipboard}>
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/90">
            {shareText}
          </pre>
          {previewUrl && (
            <div className="mt-3 flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px]">
              <span className="text-muted-foreground">
                Want to see how it looks over a video first?
              </span>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-amber-500 underline-offset-2 hover:underline"
              >
                Open preview mode →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
