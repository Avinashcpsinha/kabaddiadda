'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteCoachAction } from './actions';

export function DeleteCoach({
  tournamentId,
  teamId,
  coachId,
  name,
}: {
  tournamentId: string;
  teamId: string;
  coachId: string;
  name: string;
}) {
  const [pending, startTransition] = React.useTransition();

  function onClick() {
    if (!confirm(`Remove ${name} from the coaching staff?`)) return;
    startTransition(async () => {
      const res = await deleteCoachAction(tournamentId, teamId, coachId);
      if (res?.error) toast.error(res.error);
      else toast.success('Coach removed');
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive"
      aria-label={`Remove ${name}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
