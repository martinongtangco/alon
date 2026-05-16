-- Alon Database Setup Script
-- Authoritative DDL for all schemas: app, admin, audit
-- Requires PostgreSQL 16+ and PostGIS extension
-- See: docs/decisions/0010-app-schema-data-model.md
--
-- WARNING (DEV ONLY): This script drops and recreates all app.* and admin.*
-- tables. Run only against a local dev database. Never run in production.

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- SCHEMAS
-- ============================================================
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS audit;

-- ============================================================
-- DROP EXISTING TABLES (dev reset — order matters for FKs)
-- app tables first (they reference admin.users), then admin
-- ============================================================
DROP TABLE IF EXISTS app.flags          CASCADE;
DROP TABLE IF EXISTS app.buzz_events    CASCADE;
DROP TABLE IF EXISTS app.reveal_events  CASCADE;
DROP TABLE IF EXISTS app.events         CASCADE;
DROP TABLE IF EXISTS app.promos         CASCADE;
DROP TABLE IF EXISTS app.businesses     CASCADE;
DROP TABLE IF EXISTS app.users          CASCADE;
DROP TABLE IF EXISTS admin.platform_config CASCADE;
DROP TABLE IF EXISTS admin.users        CASCADE;

-- ============================================================
-- ADMIN SCHEMA
-- Created first because app.* tables reference admin.users(id)
-- ============================================================

CREATE TABLE admin.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    totp_secret     VARCHAR(255),
    totp_enabled    BOOLEAN NOT NULL DEFAULT false,
    role            VARCHAR(20) NOT NULL
                    CHECK (role IN ('SUPER_ADMIN', 'OPS', 'FINANCE')),
    status          VARCHAR(20) NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Inactive')),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMP WITH TIME ZONE
);

CREATE TABLE admin.platform_config (
    key         VARCHAR(255) PRIMARY KEY,
    value       JSONB NOT NULL,
    -- tier documents how quickly the setting takes effect (see admin-dashboard-spec §11 / ADR 0010)
    tier        VARCHAR(10) NOT NULL DEFAULT 'hot'
                CHECK (tier IN ('hot', 'warm', 'cold')),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by  UUID REFERENCES admin.users(id)
);

-- Default config values — idempotent, skips if key already exists
INSERT INTO admin.platform_config (key, value, tier) VALUES
    -- Proximity engine
    ('ble_scan_interval_ms',            '220',          'hot'),
    ('buzz_cooldown_seconds',           '30',           'hot'),
    ('max_promo_broadcast_radius_m',    '200',          'hot'),
    ('ghost_mode_ble_behavior',         '"full_halt"',  'hot'),
    ('uwb_enabled',                     'true',         'hot'),
    -- Promo rules
    ('promo_min_radius_m',              '25',           'hot'),
    ('promo_max_radius_basic_m',        '75',           'hot'),
    ('promo_max_radius_pro_m',          '200',          'hot'),
    ('promo_max_redemption_limit',      '10000',        'hot'),
    ('require_promo_approval',          'false',        'hot'),
    -- Moderation
    ('auto_flag_buzz_rate_per_min',     '8',            'hot'),
    ('reports_before_auto_suspend',     '5',            'hot'),
    ('auto_suspend_flagged',            'true',         'hot'),
    ('email_admin_on_high_severity',    'true',         'hot'),
    -- Feature flags
    ('feature_visualizer',              'true',         'hot'),
    ('feature_dating_mode',             'false',        'hot'),
    ('feature_community_events',        'false',        'hot'),
    ('feature_brand_activations',       'false',        'hot'),
    ('feature_vibr8_pro',               'false',        'hot')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- APP SCHEMA
-- ============================================================

-- Users (mobile app accounts)
CREATE TABLE app.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name    VARCHAR(100) NOT NULL,
    -- BLE broadcast token — advertised instead of the user's UUID (never contains PII)
    internal_token  VARCHAR(255) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    photo_url       TEXT,
    bio             VARCHAR(500),
    ghost_mode      BOOLEAN NOT NULL DEFAULT false,
    current_mode    VARCHAR(20) NOT NULL DEFAULT 'Networking'
                    CHECK (current_mode IN ('Networking', 'Chill', 'Dating', 'Explorer')),
    vibes           JSONB NOT NULL DEFAULT '[]',
    plan            VARCHAR(20) NOT NULL DEFAULT 'Free'
                    CHECK (plan IN ('Free', 'Pro')),
    -- Phone (ADR 0032: M2 User Account Model)
    phone           TEXT UNIQUE,
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    -- Moderation status — Ghost is not a status; use ghost_mode boolean instead
    status          VARCHAR(20) NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Flagged', 'Suspended', 'Banned')),
    platform        VARCHAR(10)
                    CHECK (platform IN ('iOS', 'Android')),
    push_token      TEXT,                   -- ADR 0031: Expo push token (nullable)
    suspended_until TIMESTAMP WITH TIME ZONE,
    banned_at       TIMESTAMP WITH TIME ZONE,
    last_active_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Partner businesses
CREATE TABLE app.businesses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    category            VARCHAR(100) NOT NULL,
    plan                VARCHAR(20) NOT NULL DEFAULT 'Basic'
                        CHECK (plan IN ('Basic', 'Pro', 'Enterprise')),
    status              VARCHAR(20) NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Active', 'Pending', 'Suspended', 'Cancelled')),
    -- Contact (primary contact person for this account)
    contact_name        VARCHAR(255) NOT NULL,
    contact_email       VARCHAR(255) UNIQUE NOT NULL,
    contact_phone       VARCHAR(50),
    -- Location (physical address + PostGIS point for proximity queries)
    address_line1       TEXT,
    address_city        VARCHAR(100),
    address_state       VARCHAR(100),
    address_country     VARCHAR(100) NOT NULL DEFAULT 'AU',
    location            GEOMETRY(Point, 4326),
    -- Admin-only fields
    admin_notes         TEXT,
    approved_at         TIMESTAMP WITH TIME ZONE,
    approved_by         UUID REFERENCES admin.users(id),
    rejected_at         TIMESTAMP WITH TIME ZONE,
    rejection_reason    TEXT,
    suspended_at        TIMESTAMP WITH TIME ZONE,
    suspension_reason   TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Promos (partner-created, admin-moderated)
-- active_promo_count and mrr_contribution are NOT stored — computed at query time
CREATE TABLE app.promos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id         UUID NOT NULL REFERENCES app.businesses(id),
    headline            VARCHAR(255) NOT NULL,
    description         TEXT,
    offer_text          VARCHAR(500),
    broadcast_radius    INTEGER NOT NULL
                        CHECK (broadcast_radius > 0 AND broadcast_radius <= 10000),
    redemption_count    INTEGER NOT NULL DEFAULT 0,
    redemption_limit    INTEGER,    -- NULL = unlimited (flagged as fraud indicator in admin UI)
    status              VARCHAR(30) NOT NULL DEFAULT 'Pending Approval'
                        CHECK (status IN ('Active', 'Paused', 'Flagged', 'Expired', 'Killed', 'Pending Approval')),
    starts_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMP WITH TIME ZONE,
    -- Admin moderation trail
    paused_at           TIMESTAMP WITH TIME ZONE,
    paused_by           UUID REFERENCES admin.users(id),
    killed_at           TIMESTAMP WITH TIME ZONE,
    killed_by           UUID REFERENCES admin.users(id),
    kill_reason         TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Events (partner or community submitted)
-- Exactly one of (business_id, community_submitter_id) must be non-null — enforced by CHECK
CREATE TABLE app.events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(255) NOT NULL,
    description             TEXT,
    -- Organizer: partner business XOR community user
    business_id             UUID REFERENCES app.businesses(id),
    community_submitter_id  UUID REFERENCES app.users(id),
    is_community            BOOLEAN NOT NULL DEFAULT false,  -- denormalized for fast filtering
    -- Location
    address_text            TEXT,
    location                GEOMETRY(Point, 4326),
    -- Timing
    event_date              TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date                TIMESTAMP WITH TIME ZONE,
    -- Classification
    vibe_tags               JSONB NOT NULL DEFAULT '[]',
    estimated_reach         INTEGER,
    status                  VARCHAR(30) NOT NULL DEFAULT 'Pending Review'
                            CHECK (status IN ('Scheduled', 'Live', 'Ended', 'Pending Review', 'Rejected')),
    is_featured             BOOLEAN NOT NULL DEFAULT false,
    -- Admin moderation trail
    approved_at             TIMESTAMP WITH TIME ZONE,
    approved_by             UUID REFERENCES admin.users(id),
    rejected_at             TIMESTAMP WITH TIME ZONE,
    rejected_by             UUID REFERENCES admin.users(id),
    rejection_reason        TEXT,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_event_organizer CHECK (
        (business_id IS NOT NULL AND community_submitter_id IS NULL AND is_community = false) OR
        (business_id IS NULL AND community_submitter_id IS NOT NULL AND is_community = true)
    )
);

-- Moderation flags (polymorphic — subject_type discriminates between user/business/promo/event)
-- subject_id is NOT a typed FK; referential integrity is enforced at the service layer
CREATE TABLE app.flags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity            VARCHAR(10) NOT NULL DEFAULT 'Low'
                        CHECK (severity IN ('High', 'Medium', 'Low')),
    type                VARCHAR(30) NOT NULL
                        CHECK (type IN ('Profile Report', 'Promo Fraud', 'Buzz Spam', 'Content', 'Other')),
    subject_id          UUID NOT NULL,
    subject_type        VARCHAR(20) NOT NULL
                        CHECK (subject_type IN ('user', 'business', 'promo', 'event')),
    reporter_id         UUID REFERENCES app.users(id),   -- NULL if system auto-flagged
    report_count        INTEGER NOT NULL DEFAULT 1,
    summary             TEXT,
    auto_flagged        BOOLEAN NOT NULL DEFAULT false,
    status              VARCHAR(20) NOT NULL DEFAULT 'Open'
                        CHECK (status IN ('Open', 'In Review', 'Resolved')),
    assigned_to         UUID REFERENCES admin.users(id),
    -- Resolution
    resolved_at         TIMESTAMP WITH TIME ZONE,
    resolved_by         UUID REFERENCES admin.users(id),
    resolution_notes    TEXT,
    resolution_action   VARCHAR(50),  -- e.g. 'dismissed', 'user_suspended', 'promo_killed', 'escalated'
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Buzz Me event log — used for rate limiting (max 3 buzzes/person/day) and fraud analytics
CREATE TABLE app.buzz_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES app.users(id),
    recipient_id    UUID NOT NULL REFERENCES app.users(id),
    sent_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_buzz CHECK (sender_id <> recipient_id)
);

-- Proximity reveal history — mutual reveals between users
CREATE TABLE app.reveal_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiator_id    UUID NOT NULL REFERENCES app.users(id),
    recipient_id    UUID NOT NULL REFERENCES app.users(id),
    mutual          BOOLEAN NOT NULL DEFAULT false,
    mutual_at       TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_reveal CHECK (initiator_id <> recipient_id)
);

-- ============================================================
-- INDEXES (app schema)
-- ============================================================

-- Users — admin table filters
CREATE INDEX idx_users_status      ON app.users(status);
CREATE INDEX idx_users_plan        ON app.users(plan);
CREATE INDEX idx_users_platform    ON app.users(platform);
CREATE INDEX idx_users_last_active ON app.users(last_active_at DESC);
CREATE INDEX idx_users_ghost_mode  ON app.users(ghost_mode) WHERE ghost_mode = true;
CREATE INDEX idx_users_email       ON app.users(email);

-- Businesses
CREATE INDEX idx_businesses_status   ON app.businesses(status);
CREATE INDEX idx_businesses_plan     ON app.businesses(plan);
CREATE INDEX idx_businesses_city     ON app.businesses(address_city);
CREATE INDEX idx_businesses_location ON app.businesses USING GIST(location);

-- Promos
CREATE INDEX idx_promos_business_id ON app.promos(business_id);
CREATE INDEX idx_promos_status      ON app.promos(status);
CREATE INDEX idx_promos_expires_at  ON app.promos(expires_at);

-- Events
CREATE INDEX idx_events_status     ON app.events(status);
CREATE INDEX idx_events_event_date ON app.events(event_date);
CREATE INDEX idx_events_featured   ON app.events(is_featured) WHERE is_featured = true;
CREATE INDEX idx_events_location   ON app.events USING GIST(location);

-- Flags — moderation queue access patterns
CREATE INDEX idx_flags_status     ON app.flags(status);
CREATE INDEX idx_flags_severity   ON app.flags(severity);
CREATE INDEX idx_flags_subject    ON app.flags(subject_type, subject_id);
CREATE INDEX idx_flags_created_at ON app.flags(created_at DESC);

-- Buzz events — rate limiting lookups
CREATE INDEX idx_buzz_sender ON app.buzz_events(sender_id, sent_at DESC);

-- Matches (mutual reveal) — ADR 0029
CREATE TABLE IF NOT EXISTS app.matches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_a    UUID NOT NULL REFERENCES app.users(id),
    device_b    UUID NOT NULL REFERENCES app.users(id),
    status      TEXT NOT NULL DEFAULT 'mutual',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_a, device_b)
);

CREATE INDEX idx_matches_status ON app.matches(status);

-- ============================================================
-- AUDIT SCHEMA
-- Append-only partitioned table — see ADR 0009
-- Using IF NOT EXISTS: audit schema may already exist correctly
-- ============================================================

CREATE TABLE IF NOT EXISTS audit.entries (
    id              UUID DEFAULT gen_random_uuid(),
    admin_id        UUID NOT NULL,
    admin_role      VARCHAR(20) NOT NULL,
    action_type     VARCHAR(100) NOT NULL,
    subject_id      VARCHAR(255),
    before_state    JSONB,
    after_state     JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE OR REPLACE FUNCTION audit.create_audit_partitions(months_ahead INT) RETURNS void AS $$
DECLARE
    base_date      DATE := date_trunc('month', NOW());
    target_date    DATE;
    partition_name TEXT;
    start_date     TEXT;
    end_date       TEXT;
BEGIN
    FOR i IN 0..months_ahead LOOP
        target_date    := base_date + (i || ' month')::interval;
        partition_name := 'entries_y' || to_char(target_date, 'YYYY') || 'm' || to_char(target_date, 'MM');
        start_date     := to_char(target_date, 'YYYY-MM-01');
        end_date       := to_char(target_date + '1 month'::interval, 'YYYY-MM-01');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS audit.%I PARTITION OF audit.entries FOR VALUES FROM (%L) TO (%L);',
            partition_name, start_date, end_date
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT audit.create_audit_partitions(12);

-- ============================================================
-- DB ROLES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_writer') THEN
        CREATE ROLE audit_writer NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA audit TO audit_writer;
REVOKE ALL ON audit.entries FROM audit_writer;
GRANT INSERT ON audit.entries TO audit_writer;
