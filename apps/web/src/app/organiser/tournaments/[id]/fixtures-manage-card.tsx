'use client';

import Link from 'next/link';
import { Calendar, Plus } from 'lucide-react';
import { AddFixtureModal } from '@/app/organiser/fixtures/add-fixture-modal';

interface TeamLite {
  id: string;
  name: string;
  short_name: string | null;
}

// Hybrid card: the body acts as a link to the fixtures list page; the trailing
// + button opens the AddFixtureModal in-place (no navigation). Splitting these
// gives the operator a one-click 'add' without losing context, while the body
// click still does the obvious thing (view all fixtures).
export function FixturesManageCard({
  tournamentId,
  tournamentName,
  matchCount,
  teams,
}: {
  tournamentId: string;
  tournamentName: string;
  matchCount: number;
  teams: TeamLite[];
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/50 p-4 transition-colors hover:bg-accent/30">
      <Link
        href={`/organiser/tournaments/${tournamentId}/fixtures`}
        className="flex flex-1 items-center gap-4 -m-4 p-4"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-medium">Fixtures</div>
          <div className="text-xs text-muted-foreground">{matchCount} matches scheduled</div>
        </div>
      </Link>
      <AddFixtureModal
        tournamentId={tournamentId}
        tournamentName={tournamentName}
        teams={teams}
      />
    </div>
  );
}
