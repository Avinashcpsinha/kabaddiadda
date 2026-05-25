'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateDemoRequestAction } from './actions';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'spam'] as const;
type Status = (typeof STATUSES)[number];

export function StatusForm({
  id,
  status,
  adminNote,
}: {
  id: string;
  status: Status;
  adminNote: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [localStatus, setLocalStatus] = React.useState<Status>(status);
  const [localNote, setLocalNote] = React.useState(adminNote);

  const dirty = localStatus !== status || localNote !== adminNote;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateDemoRequestAction(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res?.success) toast.success(res.success);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        value={localStatus}
        onChange={(e) => setLocalStatus(e.target.value as Status)}
        disabled={pending}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="capitalize">
            {s}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="admin_note"
        value={localNote}
        onChange={(e) => setLocalNote(e.target.value)}
        placeholder="Internal note (optional)"
        maxLength={2000}
        disabled={pending}
        className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <Button type="submit" size="sm" disabled={pending || !dirty}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
      </Button>
    </form>
  );
}
