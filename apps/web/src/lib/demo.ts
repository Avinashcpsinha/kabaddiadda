/**
 * Demo seed data — shared constants used to provision a fresh demo tenant
 * for each visitor who clicks "Try live scoring" on the marketing homepage.
 *
 * Each click creates an ephemeral organiser account + tenant via
 * createDemoSession (in demo-seed.ts) so concurrent visitors never collide.
 * Demo accounts are cleaned up by /api/cron/reset-demo after 24 hours.
 */

export const DEMO_EMAIL_DOMAIN = 'kabaddiadda.in';
/** Demo accounts are identified by this email prefix. Cleanup uses it. */
export const DEMO_EMAIL_PREFIX = 'demo-';
/** Sessions older than this are deleted by the cleanup cron. */
export const DEMO_SESSION_TTL_HOURS = 24;

export const DEMO_TEAMS = [
  { name: 'Bengaluru Bulls', short_name: 'BLR', city: 'Bengaluru', primary_color: '#f97316' },
  { name: 'Chennai Chargers', short_name: 'CHE', city: 'Chennai', primary_color: '#0ea5e9' },
  { name: 'Delhi Dynamos', short_name: 'DEL', city: 'Delhi', primary_color: '#22c55e' },
  { name: 'Mumbai Mavericks', short_name: 'MUM', city: 'Mumbai', primary_color: '#a855f7' },
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
