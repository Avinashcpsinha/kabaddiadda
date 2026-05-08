// Shared row shapes for Supabase queries used across multiple screens.
// Naming mirrors the web app's ad-hoc interfaces in apps/web/src/app/...
// so the same select() strings produce a value of these types.

export interface TeamLite {
  id?: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
}

export interface LiveMatchRow {
  id: string;
  home_score: number;
  away_score: number;
  current_half: number;
  clock_seconds: number;
  scheduled_at: string;
  round: string | null;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
  tournament: { name: string; slug?: string } | null;
  tenant: { name: string; slug?: string; logo_url?: string | null } | null;
}

export interface UpcomingMatchRow {
  id: string;
  scheduled_at: string;
  round: string | null;
  home_team: { name: string; short_name: string | null } | null;
  away_team: { name: string; short_name: string | null } | null;
  tournament: { name: string } | null;
  tenant: { name: string; slug?: string } | null;
}

export interface TournamentRow {
  id: string;
  slug: string;
  name: string;
  format: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  cover_image: string | null;
  tenant: { slug: string; name: string; logo_url: string | null } | null;
}
