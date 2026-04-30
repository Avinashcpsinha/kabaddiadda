'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { FormSubmit } from '@/components/form-submit';
import { createMatchAction } from './actions';

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
}

export function AddMatchForm({
  tournamentId,
  teams,
}: {
  tournamentId: string;
  teams: TeamLite[];
}) {
  const formRef = React.useRef<HTMLFormElement>(null);

  async function action(fd: FormData) {
    const res = await createMatchAction(tournamentId, fd);
    if (res?.error) toast.error(res.error);
    else {
      toast.success('Match scheduled');
      formRef.current?.reset();
    }
  }

  if (teams.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Register at least 2 teams in this tournament before scheduling matches.
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="round" className="text-xs">
          Round / label (optional)
        </Label>
        <Input id="round" name="round" placeholder="Group A · Match 1" maxLength={60} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="homeTeamId" className="text-xs">
          Home
        </Label>
        <Select id="homeTeamId" name="homeTeamId" required defaultValue="">
          <option value="" disabled>
            Pick home team
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="awayTeamId" className="text-xs">
          Away
        </Label>
        <Select id="awayTeamId" name="awayTeamId" required defaultValue="">
          <option value="" disabled>
            Pick away team
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scheduledAt" className="text-xs">
          Date &amp; time
        </Label>
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
      </div>
      <FormSubmit className="w-full">
        <Plus className="h-4 w-4" />
        Add match
      </FormSubmit>
    </form>
  );
}
