#!/usr/bin/env node
/**
 * Verify per-player stats by comparing what player_match_stats reports
 * against a re-derivation from match_events. Run with a match id.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/verify-stats.mjs <match_id>
 */
import postgres from 'postgres';

const matchId = process.argv[2];
if (!matchId) {
  console.error('Usage: verify-stats.mjs <match_id>');
  process.exit(1);
}

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  console.error('POSTGRES_URL_NON_POOLING (or DATABASE_URL) must be set');
  process.exit(1);
}

const client = postgres(url, { prepare: false, ssl: 'require' });

try {
  // 1) Player_match_stats view rows
  const viewRows = await client`
    select pms.player_id, p.full_name, p.jersey_number,
           pms.raid_points, pms.tackle_points, pms.super_raids, pms.super_tackles,
           pms.bonus_points, pms.empty_raids, pms.dod_attempts, pms.dod_conversions,
           pms.total_raids, pms.successful_raids, pms.total_tackles
    from public.player_match_stats pms
    join public.players p on p.id = pms.player_id
    where pms.match_id = ${matchId}
    order by (pms.raid_points + pms.tackle_points) desc nulls last
  `;

  console.log(`\n=== VIEW (player_match_stats) for match ${matchId} ===`);
  for (const r of viewRows) {
    console.log(
      `  ${r.full_name.padEnd(20)} #${(r.jersey_number ?? '?').toString().padStart(2)} ` +
      `R=${r.raid_points} T=${r.tackle_points} ` +
      `SR=${r.super_raids} ST=${r.super_tackles} ` +
      `bonus=${r.bonus_points} empty=${r.empty_raids} DoD=${r.dod_conversions}/${r.dod_attempts}`,
    );
  }

  // 2) Re-derive the same numbers ourselves so we can spot under/over-count
  console.log(`\n=== RAW EVENT-LEVEL TOTALS (re-derived) ===`);

  const raiderTotals = await client`
    select e.raider_id as player_id, p.full_name, p.jersey_number,
           sum(e.points_attacker)                                                          as att_points_sum,
           count(*) filter (where e.type = 'raid_point')                                   as raid_pt_evts,
           count(*) filter (where e.type = 'super_raid')                                   as super_raid_evts,
           count(*) filter (where e.type = 'bonus_point')                                  as bonus_solo_evts,
           count(*) filter (where e.type = 'empty_raid')                                   as empty_evts,
           count(*) filter (where e.type = 'do_or_die_raid')                               as dod_evts,
           count(*) filter (where e.type in ('tackle_point','super_tackle') and e.points_attacker > 0) as bonus_in_combo
    from public.match_events e
    left join public.players p on p.id = e.raider_id
    where e.match_id = ${matchId}
      and e.raider_id is not null
      and e.type in ('raid_point','super_raid','bonus_point','empty_raid','do_or_die_raid','tackle_point','super_tackle')
    group by e.raider_id, p.full_name, p.jersey_number
    having sum(e.points_attacker) > 0 or count(*) > 0
  `;

  console.log(`-- Raiders --`);
  for (const r of raiderTotals) {
    const tot = Number(r.att_points_sum ?? 0);
    console.log(
      `  ${(r.full_name ?? 'Unknown').padEnd(20)} #${(r.jersey_number ?? '?').toString().padStart(2)} ` +
      `att-sum=${tot} ` +
      `raids=${r.raid_pt_evts}/${r.super_raid_evts}sr/${r.bonus_solo_evts}b/${r.empty_evts}e/${r.dod_evts}dod ` +
      `bonus-in-combo=${r.bonus_in_combo}`,
    );
  }

  // Tackle credit
  const tackleTotals = await client`
    with defs as (
      select e.id, e.type, e.is_super_tackle, e.points_defender,
             (jsonb_array_elements_text(e.defender_ids))::uuid as defender_id
      from public.match_events e
      where e.match_id = ${matchId}
        and e.defender_ids is not null
        and jsonb_array_length(e.defender_ids) > 0
        and e.type in ('tackle_point', 'super_tackle')
    )
    select d.defender_id as player_id, p.full_name, p.jersey_number,
           count(*) filter (where d.type = 'tackle_point' and not coalesce(d.is_super_tackle, false)) as reg_tackles,
           count(*) filter (where d.type = 'super_tackle' or d.is_super_tackle) as super_tackles_evts,
           count(*) as total_evts
    from defs d
    left join public.players p on p.id = d.defender_id
    group by d.defender_id, p.full_name, p.jersey_number
  `;

  console.log(`-- Defenders (tackle participations) --`);
  for (const r of tackleTotals) {
    const correct = Number(r.reg_tackles) * 1 + Number(r.super_tackles_evts) * 2;
    console.log(
      `  ${(r.full_name ?? 'Unknown').padEnd(20)} #${(r.jersey_number ?? '?').toString().padStart(2)} ` +
      `reg=${r.reg_tackles} super=${r.super_tackles_evts} ` +
      `→ correct tackle_points (PKL) = ${correct}`,
    );
  }

  // Compare bugs side-by-side
  console.log(`\n=== DIFF (view vs. correct) ===`);
  const byPlayer = new Map();
  for (const r of viewRows) byPlayer.set(r.player_id, { view: r });
  for (const r of tackleTotals) {
    const correct = Number(r.reg_tackles) * 1 + Number(r.super_tackles_evts) * 2;
    const entry = byPlayer.get(r.player_id) ?? {};
    entry.derivedTacklePts = correct;
    entry.regTackles = Number(r.reg_tackles);
    entry.superTackles = Number(r.super_tackles_evts);
    entry.name = r.full_name;
    byPlayer.set(r.player_id, entry);
  }
  for (const r of raiderTotals) {
    const entry = byPlayer.get(r.player_id) ?? {};
    entry.derivedRaidPts = Number(r.att_points_sum ?? 0);
    entry.bonusInCombo = Number(r.bonus_in_combo ?? 0);
    entry.name = r.full_name ?? entry.name;
    byPlayer.set(r.player_id, entry);
  }
  for (const [pid, e] of byPlayer) {
    if (!e.view) continue;
    const vT = e.view.tackle_points;
    const vR = e.view.raid_points;
    const cT = e.derivedTacklePts ?? 0;
    const cR = e.derivedRaidPts ?? 0;
    const tDelta = cT - vT;
    const rDelta = cR - vR;
    if (tDelta === 0 && rDelta === 0) continue;
    console.log(
      `  ${(e.name ?? 'Unknown').padEnd(20)} ` +
      `T: view=${vT} correct=${cT} Δ=${tDelta >= 0 ? '+' : ''}${tDelta}  ` +
      `R: view=${vR} correct=${cR} Δ=${rDelta >= 0 ? '+' : ''}${rDelta}` +
      (e.bonusInCombo > 0 ? ` (${e.bonusInCombo} bonus in tackle combos)` : ''),
    );
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
