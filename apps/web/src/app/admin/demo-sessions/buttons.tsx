'use client';

import * as React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteDemoSessionAction, purgeAllDemoUsersAction } from './actions';

export function DeleteSessionButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = React.useTransition();
  function onClick() {
    if (!confirm(`Delete ${name}'s demo session and its demo user?`)) return;
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      const res = await deleteDemoSessionAction(fd);
      if (res?.error) toast.error(res.error);
      else toast.success('Deleted');
    });
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive"
      aria-label={`Delete ${name}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}

export function PurgeAllButton() {
  const [pending, startTransition] = React.useTransition();
  function onClick() {
    if (
      !confirm(
        'Purge ALL demo users and their sandbox tenants now? Lead records below are kept; only the demo accounts/data are deleted.',
      )
    )
      return;
    startTransition(async () => {
      const res = await purgeAllDemoUsersAction();
      if (res?.error) toast.error(res.error);
      else toast.success(res?.success ?? 'Purged');
    });
  }
  return (
    <Button variant="destructive" size="sm" onClick={onClick} disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
      Purge all demo users
    </Button>
  );
}
