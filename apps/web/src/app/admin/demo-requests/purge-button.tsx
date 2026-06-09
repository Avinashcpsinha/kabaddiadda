'use client';

import * as React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { purgeDemoSandboxesAction } from './actions';

/**
 * Purge throwaway demo sandboxes (demo tenants + logins). Leads are kept —
 * only the ephemeral demo accounts/data are removed.
 */
export function PurgeSandboxesButton() {
  const [pending, startTransition] = React.useTransition();
  function onClick() {
    if (
      !confirm(
        'Delete all throwaway demo sandboxes (demo logins + sample data) now?\n\nLeads are KEPT — only the ephemeral demo accounts are removed.',
      )
    )
      return;
    startTransition(async () => {
      const res = await purgeDemoSandboxesAction();
      if (res?.error) toast.error(res.error);
      else toast.success(res?.success ?? 'Purged');
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
      Purge demo sandboxes
    </Button>
  );
}
