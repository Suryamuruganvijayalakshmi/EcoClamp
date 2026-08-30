-- ============================================================================
-- EcoClamp — add baseline reset support
-- Run this once against an existing project (e.g. via the Supabase SQL
-- editor, or `supabase db push`). Safe to re-run.
--
-- Lets an operator reset a machine's learned baseline from the Live Energy
-- page -- readings recorded before `baseline_reset_at` are ignored when
-- computing that machine's baseline (and everything derived from it:
-- anomaly detection, health score, forecast) so the AI starts re-learning
-- the machine's normal behavior from scratch, without deleting any
-- historical readings.
-- ============================================================================

alter table machines
  add column if not exists baseline_reset_at timestamptz;
