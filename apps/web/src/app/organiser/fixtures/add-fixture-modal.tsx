'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createMatchAction } from '@/app/organiser/tournaments/[id]/fixtures/actions';

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
}

// Add-fixture modal that opens inline on the /organiser/fixtures page.
// Uses native <dialog> for built-in backdrop + Esc-to-close + a11y; on
// submit we call the existing per-tournament createMatchAction, then
// router.refresh() so the new match appears in the accordion.
export function AddFixtureModal({
  tournamentId,
  tournamentName,
  teams,
}: {
  tournamentId: string;
  tournamentName: string;
  teams: TeamLite[];
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function open(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
    formRef.current?.reset();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Combine separate date + time inputs into the single scheduledAt the
    // action expects. We use separate inputs because <input type="datetime-local">
    // has notoriously poor UX in most browsers (no time picker on Firefox,
    // calendar that doesn't auto-close on Edge/Chrome).
    const date = String(fd.get('date') ?? '');
    const time = String(fd.get('time') ?? '');
    if (!date || !time) {
      toast.error('Pick a date and time');
      return;
    }
    fd.set('scheduledAt', `${date}T${time}`);
    fd.delete('date');
    fd.delete('time');

    startTransition(async () => {
      const res = await createMatchAction(tournamentId, fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Match scheduled');
      formRef.current?.reset();
      dialogRef.current?.close();
      router.refresh();
    });
  }

  // Disabled state when the tournament has fewer than 2 teams
  const canAdd = teams.length >= 2;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Plus className="h-3 w-3" />
        Add fixture
      </button>

      <dialog
        ref={dialogRef}
        // Native <dialog> opened via showModal() centers itself with margin:auto,
        // but Tailwind's reset / preflight nukes that. Pin it manually with
        // fixed positioning + transform-based centering. m-0 prevents any
        // inherited margin from offsetting it.
        className="fixed left-1/2 top-1/2 m-0 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          // Click on the backdrop (dialog itself, not its contents) closes
          if (e.target === e.currentTarget) close();
        }}
      >
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold">Schedule a match</h2>
              <p className="mt-1 text-xs text-muted-foreground">in {tournamentName}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!canAdd ? (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Register at least 2 teams in this tournament before scheduling a match.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor={`round-${tournamentId}`} className="text-xs">
                  Round / label (optional)
                </Label>
                <Input
                  id={`round-${tournamentId}`}
                  name="round"
                  placeholder="Group A · Match 1"
                  maxLength={60}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`home-${tournamentId}`} className="text-xs">
                    Home
                  </Label>
                  <Select id={`home-${tournamentId}`} name="homeTeamId" required defaultValue="">
                    <option value="" disabled>
                      Pick…
                    </option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`away-${tournamentId}`} className="text-xs">
                    Away
                  </Label>
                  <Select id={`away-${tournamentId}`} name="awayTeamId" required defaultValue="">
                    <option value="" disabled>
                      Pick…
                    </option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`date-${tournamentId}`} className="text-xs">
                    Date
                  </Label>
                  <Input
                    id={`date-${tournamentId}`}
                    name="date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`time-${tournamentId}`} className="text-xs">
                    Time
                  </Label>
                  <Input
                    id={`time-${tournamentId}`}
                    name="time"
                    type="time"
                    required
                    defaultValue="19:00"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {pending ? 'Scheduling…' : 'Schedule match'}
                </button>
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
