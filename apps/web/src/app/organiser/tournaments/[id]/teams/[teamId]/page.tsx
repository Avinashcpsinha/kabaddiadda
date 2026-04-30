import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Crown, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/utils';
import { AddPlayerForm } from './add-player-form';
import { DeletePlayer } from './delete-player';

const ROLE_LABEL: Record<string, string> = {
  raider: 'Raider',
  all_rounder: 'All-rounder',
  defender_corner: 'Defender · Corner',
  defender_cover: 'Defender · Cover',
};

const ROLE_TONE: Record<string, string> = {
  raider: 'bg-red-500/15 text-red-500 ring-red-500/30',
  all_rounder: 'bg-amber-500/15 text-amber-500 ring-amber-500/30',
  defender_corner: 'bg-sky-500/15 text-sky-500 ring-sky-500/30',
  defender_cover: 'bg-blue-500/15 text-blue-500 ring-blue-500/30',
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const { id, teamId } = await params;
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, short_name, city, primary_color, tournament_id')
    .eq('id', teamId)
    .eq('tenant_id', user!.tenantId!)
    .maybeSingle();

  if (!team) notFound();

  const { data: players } = await supabase
    .from('players')
    .select(
      `id, full_name, jersey_number, role, height_cm, weight_kg, is_captain, photo_url,
       person:person_id(id, mobile, pan, aadhaar)`,
    )
    .eq('team_id', teamId)
    .order('jersey_number', { ascending: true, nullsFirst: false });

  const captainCount = players?.filter((p) => p.is_captain).length ?? 0;

  return (
    <div className="space-y-6">
      <Link
        href={`/organiser/tournaments/${id}/teams`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All teams
      </Link>

      <header className="flex items-center gap-5 border-b border-border/50 pb-6">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg"
          style={{
            background: team.primary_color
              ? `linear-gradient(135deg, ${team.primary_color}, ${team.primary_color}cc)`
              : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
          }}
        >
          {team.short_name || initials(team.name)}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            {team.city && <span>{team.city}</span>}
            <span>·</span>
            <span>
              {players?.length ?? 0} player{players?.length === 1 ? '' : 's'}
            </span>
            {captainCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" />
                  Captain assigned
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!players || players.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No players on the roster"
              description="Use the form on the right to add the first player."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/50 bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 w-16">#</th>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 hidden md:table-cell">Mobile</th>
                      <th className="px-4 py-3 hidden lg:table-cell">H/W</th>
                      <th className="px-4 py-3 hidden xl:table-cell">KYC</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr key={p.id} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-3 font-mono">{p.jersey_number ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <PlayerAvatar
                              photoUrl={p.photo_url}
                              name={p.full_name}
                              color={team.primary_color}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span className="truncate">{p.full_name}</span>
                                {p.is_captain && (
                                  <Crown
                                    className="h-3 w-3 shrink-0 text-amber-500"
                                    aria-label="Captain"
                                  />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground md:hidden">
                                {/* @ts-expect-error supabase nested join typing */}
                                {p.person?.mobile ?? '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`font-normal ${ROLE_TONE[p.role] ?? ''} ring-1`}
                          >
                            {ROLE_LABEL[p.role] ?? p.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">
                          {/* @ts-expect-error supabase nested join typing */}
                          {p.person?.mobile ?? '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                          {p.height_cm ? `${p.height_cm}cm` : ''}
                          {p.height_cm && p.weight_kg ? ' · ' : ''}
                          {p.weight_kg ? `${p.weight_kg}kg` : ''}
                          {!p.height_cm && !p.weight_kg && '—'}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <KycChips
                            // @ts-expect-error supabase nested join typing
                            pan={p.person?.pan}
                            // @ts-expect-error supabase nested join typing
                            aadhaar={p.person?.aadhaar}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DeletePlayer
                            tournamentId={id}
                            teamId={teamId}
                            playerId={p.id}
                            name={p.full_name}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold">Add player</h3>
            <AddPlayerForm tournamentId={id} teamId={teamId} hasCaptain={captainCount > 0} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlayerAvatar({
  photoUrl,
  name,
  color,
}: {
  photoUrl: string | null;
  name: string;
  color: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-border/50"
      />
    );
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{
        background: color
          ? `linear-gradient(135deg, ${color}, ${color}cc)`
          : 'linear-gradient(135deg, hsl(var(--primary)), #ea580c)',
      }}
    >
      {initials(name)}
    </div>
  );
}

/** Show whether KYC fields are populated. We never render the actual values
 * here — they live in the row but stay one click away to discourage casual
 * over-the-shoulder reads. */
function KycChips({ pan, aadhaar }: { pan: string | null; aadhaar: string | null }) {
  if (!pan && !aadhaar) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex gap-1">
      {pan && (
        <Badge variant="outline" className="text-[10px]">
          PAN ✓
        </Badge>
      )}
      {aadhaar && (
        <Badge variant="outline" className="text-[10px]">
          Aadhaar ✓
        </Badge>
      )}
    </div>
  );
}
