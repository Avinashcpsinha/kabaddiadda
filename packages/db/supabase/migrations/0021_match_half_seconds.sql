-- ===================================================================
-- 0021: per-match half length
-- ===================================================================
--
-- Half length used to live in a single hard-coded constant in
-- packages/shared/src/kabaddi.ts (1800s = 30 min). Operators want to
-- vary it per match — 20-min PKL halves for one tournament, 15-min
-- corporate-league halves for another, sometimes longer for finals.
--
-- Adds half_seconds to matches; defaults to 1800 so every existing row
-- keeps its current behavior. The lineup builder now exposes a picker
-- before "Lock & Start"; the scoring console + public live page read
-- this column instead of the constant.

alter table public.matches
  add column if not exists half_seconds integer not null default 1800;
