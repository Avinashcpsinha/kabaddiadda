'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Select } from '@/components/ui/select';
import { updateTournamentStatusAction } from '../actions';

const STATUSES = [
  { value: 'draft', label: 'Draft (private)' },
  { value: 'registration', label: 'Registration open' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function TournamentStatusControl({ id, current }: { id: string; current: string }) {
  const [pending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState(current);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    startTransition(async () => {
      const res = await updateTournamentStatusAction(id, next);
      if (res?.error) {
        toast.error(res.error);
        setValue(current);
      } else {
        toast.success('Status updated');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onChange={onChange} disabled={pending}>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
