export interface MatchSummary {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'live' | 'half_time' | 'completed' | 'abandoned';
  scheduledAt: string;
  half?: number;
  clockSeconds?: number;
}

export interface StandingsRow {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  scoreDiff: number;
  leaguePoints: number;
}
