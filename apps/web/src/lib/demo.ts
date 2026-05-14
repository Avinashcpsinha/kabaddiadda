/**
 * Demo organiser account constants — used by:
 *   - The "Sign in as demo" server action (one-click login from the homepage)
 *   - The /api/cron/reset-demo route (nightly reset)
 *   - The packages/db/scripts/setup-demo.mjs CLI (initial setup)
 *
 * The password is intentionally hard-coded and committed — this is a public
 * demo account, not a credential. Anyone signing in with these creds lands
 * in an isolated tenant that resets nightly. They cannot see or affect any
 * other tenant's data (RLS enforces tenant_id isolation on every table).
 */

export const DEMO_EMAIL = 'demo@kabaddiadda.in';
export const DEMO_PASSWORD = 'KabaddiDemo2026!';

// Stable UUIDs so every reset produces identical IDs — the deep-link to the
// live match remains valid across resets.
export const DEMO_TENANT_ID = 'd0000000-0000-0000-0000-000000000001';
export const DEMO_TOURNAMENT_ID = 'd0000000-0000-0000-0000-000000000002';
export const DEMO_MATCH_LIVE_ID = 'd0000000-0000-0000-0000-0000000000a1';
export const DEMO_MATCH_SCHEDULED_ID = 'd0000000-0000-0000-0000-0000000000a2';

export const DEMO_TEAM_IDS = [
  'd0000000-0000-0000-0000-00000000000a',
  'd0000000-0000-0000-0000-00000000000b',
  'd0000000-0000-0000-0000-00000000000c',
  'd0000000-0000-0000-0000-00000000000d',
] as const;

export const DEMO_TEAMS = [
  { id: DEMO_TEAM_IDS[0], name: 'Bengaluru Bulls', short_name: 'BLR', city: 'Bengaluru', primary_color: '#f97316' },
  { id: DEMO_TEAM_IDS[1], name: 'Chennai Chargers', short_name: 'CHE', city: 'Chennai', primary_color: '#0ea5e9' },
  { id: DEMO_TEAM_IDS[2], name: 'Delhi Dynamos', short_name: 'DEL', city: 'Delhi', primary_color: '#22c55e' },
  { id: DEMO_TEAM_IDS[3], name: 'Mumbai Mavericks', short_name: 'MUM', city: 'Mumbai', primary_color: '#a855f7' },
] as const;

export const DEMO_ROLES = [
  'raider',
  'raider',
  'all_rounder',
  'all_rounder',
  'defender_corner',
  'defender_corner',
  'defender_cover',
  'defender_cover',
] as const;

export const DEMO_NAMES_BY_TEAM: Record<string, string[]> = {
  BLR: ['Arjun Singh', 'Vikram Rao', 'Suresh Kumar', 'Rahul Joshi', 'Manoj Sharma', 'Ramesh Patel', 'Karan Mehra', 'Aakash Iyer'],
  CHE: ['Senthil Murugan', 'Karthik Reddy', 'Ganesh Iyer', 'Bharath Kumar', 'Praveen Raj', 'Sanjay Pillai', 'Vinod Krishnan', 'Suresh Babu'],
  DEL: ['Harpreet Singh', 'Amit Verma', 'Rohit Yadav', 'Deepak Tomar', 'Yashpal Gill', 'Nitin Kumar', 'Ashok Rana', 'Sumit Malik'],
  MUM: ['Pratik Shinde', 'Yash Patil', 'Rohan Desai', 'Tushar Joshi', 'Sandeep Kale', 'Mahesh Kadam', 'Vinit Naik', 'Sachin Pawar'],
};

/** Deep-link URL to drop a demo user straight into the live scoring console. */
export const DEMO_LANDING_PATH = `/organiser/tournaments/${DEMO_TOURNAMENT_ID}/matches/${DEMO_MATCH_LIVE_ID}/scoring`;
