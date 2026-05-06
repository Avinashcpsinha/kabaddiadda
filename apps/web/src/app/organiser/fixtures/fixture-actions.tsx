'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  deleteMatchAction,
  updateMatchAction,
} from '@/app/organiser/tournaments/[id]/fixtures/actions';

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
}

// Edit + delete buttons shown on scheduled-status fixture rows. Live or
// completed matches don't render this — actions are gated server-side as
// well in updateMatchAction / deleteMatchAction so a stale client can't
// mutate a live match by sending the request directly.
export function FixtureActions({
  tournamentId,
  matchId,
  teams,
  current,
}: {
  tournamentId: string;
  matchId: string;
  teams: TeamLite[];
  current: {
    homeTeamId: string;
    awayTeamId: string;
    scheduledAt: string;
    round: string | null;
  };
}) {
  const editDialogRef = React.useRef<HTMLDialogElement>(null);
  const deleteDialogRef = React.useRef<HTMLDialogElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  // Split scheduledAt into date + time inputs (matches AddFixtureModal UX).
  const scheduled = new Date(current.scheduledAt);
  const dateDefault = scheduled.toISOString().slice(0, 10);
  const timeDefault = scheduled.toTimeString().slice(0, 5);

  function openEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    editDialogRef.current?.showModal();
  }
  function closeEdit() {
    editDialogRef.current?.close();
  }
  function openDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    deleteDialogRef.current?.showModal();
  }
  function closeDelete() {
    deleteDialogRef.current?.close();
  }

  function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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
      const res = await updateMatchAction(tournamentId, matchId, fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Fixture updated');
      editDialogRef.current?.close();
      router.refresh();
    });
  }

  function onDeleteConfirm() {
    startTransition(async () => {
      const res = await deleteMatchAction(tournamentId, matchId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Fixture deleted');
      deleteDialogRef.current?.close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openEdit}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Edit fixture"
        title="Edit fixture"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={openDelete}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label="Delete fixture"
        title="Delete fixture"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Edit modal */}
      <dialog
        ref={editDialogRef}
        className="fixed left-1/2 top-1/2 m-0 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeEdit();
        }}
      >
        <form ref={formRef} onSubmit={onEditSubmit} className="space-y-4 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold">Edit fixture</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Change teams, date, time, or round label.
              </p>
            </div>
            <button
              type="button"
              onClick={closeEdit}
              className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-round-${matchId}`} className="text-xs">
              Round / label (optional)
            </Label>
            <Input
              id={`edit-round-${matchId}`}
              name="round"
              defaultValue={current.round ?? ''}
              placeholder="Group A · Match 1"
              maxLength={60}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`edit-home-${matchId}`} className="text-xs">
                Home
              </Label>
              <Select
                id={`edit-home-${matchId}`}
                name="homeTeamId"
                required
                defaultValue={current.homeTeamId}
              >
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
              <Label htmlFor={`edit-away-${matchId}`} className="text-xs">
                Away
              </Label>
              <Select
                id={`edit-away-${matchId}`}
                name="awayTeamId"
                required
                defaultValue={current.awayTeamId}
              >
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
              <Label htmlFor={`edit-date-${matchId}`} className="text-xs">
                Date
              </Label>
              <Input
                id={`edit-date-${matchId}`}
                name="date"
                type="date"
                required
                defaultValue={dateDefault}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-time-${matchId}`} className="text-xs">
                Time
              </Label>
              <Input
                id={`edit-time-${matchId}`}
                name="time"
                type="time"
                required
                defaultValue={timeDefault}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeEdit}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </dialog>

      {/* Delete confirm */}
      <dialog
        ref={deleteDialogRef}
        className="fixed left-1/2 top-1/2 m-0 w-[min(24rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDelete();
        }}
      >
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-semibold">Delete this fixture?</h2>
            <button
              type="button"
              onClick={closeDelete}
              className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            This removes the scheduled match entirely. Lineups for this match
            will also be deleted. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeDelete}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDeleteConfirm}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              {pending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
