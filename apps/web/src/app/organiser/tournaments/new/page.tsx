'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormSubmit } from '@/components/form-submit';
import { slugify } from '@/lib/slug';
import { createTournamentAction } from '../actions';

export default function NewTournamentPage() {
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);

  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function action(fd: FormData) {
    const res = await createTournamentAction(fd);
    if (res?.error) toast.error(res.error);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/organiser/tournaments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to tournaments
      </Link>

      <div>
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <Trophy className="h-5 w-5" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Create a tournament</h1>
        <p className="mt-1 text-muted-foreground">
          You can change all of this later. Status starts as Draft — publish when ready.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Tournament name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Bengal Premier Kabaddi 2026"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="bengal-premier-2026"
                pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                minLength={2}
                maxLength={40}
                required
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Becomes part of the public URL: <code>/t/your-league/{slug || 'slug'}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Tell fans and teams what this tournament is about."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select id="format" name="format" defaultValue="league" required>
                <option value="league">League — round-robin</option>
                <option value="knockout">Knockout — single elimination</option>
                <option value="group_knockout">Group stage → Knockout</option>
                <option value="double_elimination">Double elimination</option>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="maxTeams">Max teams</Label>
                <Input id="maxTeams" name="maxTeams" type="number" min={2} max={256} placeholder="12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryFee">Entry fee (₹)</Label>
                <Input id="entryFee" name="entryFee" type="number" min={0} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prizePool">Prize pool (₹)</Label>
                <Input id="prizePool" name="prizePool" type="number" min={0} placeholder="0" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button asChild variant="ghost">
                <Link href="/organiser/tournaments">Cancel</Link>
              </Button>
              <FormSubmit variant="flame">
                Create tournament
                <ArrowRight className="h-4 w-4" />
              </FormSubmit>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
