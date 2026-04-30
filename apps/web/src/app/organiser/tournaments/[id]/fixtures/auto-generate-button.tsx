'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { autoGenerateRoundRobinAction } from './actions';

export function AutoGenerateButton({
  tournamentId,
  teamCount,
  existingMatches,
  defaultStart,
}: {
  tournamentId: string;
  teamCount: number;
  existingMatches: number;
  defaultStart: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const expectedMatches = (teamCount * (teamCount - 1)) / 2;
  const disabled = teamCount < 2 || existingMatches > 0 || pending;

  function onClick() {
    if (disabled) return;
    if (
      !confirm(
        `Generate ${expectedMatches} round-robin matches starting ${new Date(
          defaultStart,
        ).toLocaleDateString()}? You can edit dates afterwards.`,
      )
    )
      return;

    startTransition(async () => {
      const res = await autoGenerateRoundRobinAction(tournamentId, defaultStart);
      if (res?.error) toast.error(res.error);
      else toast.success(`Created ${res?.count} matches`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={onClick} disabled={disabled} variant="outline">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Auto-generate round-robin
      </Button>
      <p className="text-xs text-muted-foreground">
        {teamCount < 2
          ? 'Need at least 2 teams'
          : existingMatches > 0
            ? 'Fixtures already exist'
            : `Will create ${expectedMatches} matches`}
      </p>
    </div>
  );
}
