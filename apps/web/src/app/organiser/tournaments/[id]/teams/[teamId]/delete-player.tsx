'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deletePlayerAction } from './actions';

export function DeletePlayer({
  tournamentId,
  teamId,
  playerId,
  name,
}: {
  tournamentId: string;
  teamId: string;
  playerId: string;
  name: string;
}) {
  const [pending, startTransition] = React.useTransition();

  function onClick() {
    if (!confirm(`Remove ${name} from the roster?`)) return;
    startTransition(async () => {
      const res = await deletePlayerAction(tournamentId, teamId, playerId);
      if (res?.error) toast.error(res.error);
      else toast.success('Player removed');
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
