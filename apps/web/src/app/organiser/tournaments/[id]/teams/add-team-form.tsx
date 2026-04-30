'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSubmit } from '@/components/form-submit';
import { createTeamAction } from './actions';

export function AddTeamForm({ tournamentId }: { tournamentId: string }) {
  const formRef = React.useRef<HTMLFormElement>(null);

  async function action(fd: FormData) {
    const res = await createTeamAction(tournamentId, fd);
    if (res?.error) toast.error(res.error);
    else {
      toast.success('Team added');
      formRef.current?.reset();
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-xs">
          Team name
        </Label>
        <Input id="name" name="name" placeholder="Bengal Warriors" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="shortName" className="text-xs">
            Short
          </Label>
          <Input id="shortName" name="shortName" placeholder="BEN" maxLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city" className="text-xs">
            City
          </Label>
          <Input id="city" name="city" placeholder="Kolkata" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="primaryColor" className="text-xs">
          Color (hex)
        </Label>
        <Input id="primaryColor" name="primaryColor" placeholder="#f97316" pattern="#[0-9A-Fa-f]{6}" />
      </div>
      <FormSubmit className="w-full" variant="default">
        <Plus className="h-4 w-4" />
        Add team
      </FormSubmit>
    </form>
  );
}
