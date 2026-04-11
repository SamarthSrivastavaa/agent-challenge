-- =============================================================
-- SovereignSelf — Initial Database Schema
-- =============================================================
-- This migration creates the core tables for the SovereignSelf
-- reputation monitoring and crisis detection system.

-- ─────────────────────────────────────────────────────────────
-- mentions — ingested Twitter/X mentions with sentiment data
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentions (
    id              SERIAL PRIMARY KEY,
    tweet_id        TEXT UNIQUE NOT NULL,
    author_handle   TEXT NOT NULL,
    content         TEXT NOT NULL,
    sentiment       FLOAT,                          -- -1.0 to 1.0
    sentiment_label TEXT,                            -- 'positive'|'neutral'|'negative'
    reach           INTEGER DEFAULT 0,
    is_crisis       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    ingested_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- reputation_scores — weekly reputation intelligence snapshots
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reputation_scores (
    id              SERIAL PRIMARY KEY,
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    score           FLOAT NOT NULL,                 -- 0 to 10
    mention_count   INTEGER,
    positive_pct    FLOAT,
    negative_pct    FLOAT,
    neutral_pct     FLOAT,
    total_reach     INTEGER,
    brief_text      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- agent_events — all agent actions, thoughts, alerts, and errors
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_events (
    id              SERIAL PRIMARY KEY,
    event_type      TEXT NOT NULL,                   -- 'ACTION'|'THOUGHT'|'ALERT'|'BRIEF'|'ERROR'
    event_source    TEXT NOT NULL,                   -- plugin name
    payload         JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- node_metrics — Nosana GPU node health snapshots
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_metrics (
    id              SERIAL PRIMARY KEY,
    cpu_usage       FLOAT,
    gpu_usage       FLOAT,
    memory_used_gb  FLOAT,
    memory_total_gb FLOAT,
    uptime_seconds  INTEGER,
    job_id          TEXT,
    status          TEXT,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- Indexes for efficient queries on the activity feed and timeline
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mentions_created ON mentions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created ON agent_events(created_at DESC);
