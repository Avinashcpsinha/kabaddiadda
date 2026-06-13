'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setMatchStatusAction } from './actions';

/**
 * Start a match in Normal (simple) scoring mode — no lineups required.
 * Sets the match live (keeps scoring_version = 1) and jumps straight to
 * the simple tap-to-score console. For village / casual matches that
 * don't need the full out/revival engine.
 */
export function QuickStartNormal({
  tournamentId,
  matchId,
}: {
  tournamentId: string;
  matchId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="flame"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setMatchStatusAction(tournamentId, matchId, 'live');
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          router.push(`/organiser/tournaments/${tournamentId}/matches/${matchId}/scoring`);
        })
      }
    >
      <Zap className="h-4 w-4" />
      Quick start — Normal scoring
    </Button>
  );
}
