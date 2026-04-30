'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteTournamentAction } from '../actions';

export function DangerDelete({ id, name }: { id: string; name: string }) {
  const [confirm, setConfirm] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const matches = confirm.trim() === name;

  function onDelete() {
    if (!matches) return;
    startTransition(async () => {
      const res = await deleteTournamentAction(id);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Deleting a tournament also deletes all teams, players, matches, and events scoped to it.
        This cannot be undone.
      </p>
      <div className="space-y-2">
        <Label htmlFor="confirm-name" className="text-xs">
          Type <span className="font-mono font-semibold text-foreground">{name}</span> to confirm
        </Label>
        <Input
          id="confirm-name"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={name}
        />
      </div>
      <Button variant="destructive" onClick={onDelete} disabled={!matches || pending}>
        <Trash2 className="h-4 w-4" />
        {pending ? 'Deleting…' : 'Delete tournament'}
      </Button>
    </div>
  );
}
