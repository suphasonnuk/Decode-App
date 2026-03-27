-- Run once in BigQuery Console
-- Replace YOUR_PROJECT_ID with your actual GCP Project ID

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.decode_tracker.daily_log`
(
  log_date        DATE      NOT NULL,
  week_start      DATE,
  work_anchor     STRING,
  future_anchor   STRING,
  body_anchor     STRING,
  work_task       STRING    NOT NULL,
  future_task     STRING    NOT NULL,
  body_task       STRING    NOT NULL,
  work_done       BOOL,
  future_done     BOOL,
  body_done       BOOL,
  energy_level    INT64     NOT NULL,
  focus_level     INT64,
  mood_level      INT64,
  day_outcome     STRING,
  tomorrow_action STRING,
  reflection      STRING,              -- NEW: optional end-of-day note
  submitted_at    TIMESTAMP
)
PARTITION BY log_date
OPTIONS (description = 'DECODE daily tracker — partitioned by date');
