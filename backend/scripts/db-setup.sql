-- vibr8.me Database Setup Script
-- Requires PostgreSQL 16+ and PostGIS extension

-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create Schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS audit;

-- 3. App Schema (Stubs for core tables needed by Admin references)
CREATE TABLE IF NOT EXISTS app.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(255) NOT NULL,
    internal_token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    current_mode VARCHAR(50) DEFAULT 'Networking',
    active_vibes JSONB DEFAULT '[]',
    plan VARCHAR(50) DEFAULT 'Free',
    status VARCHAR(50) DEFAULT 'Active',
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    platform VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'Basic',
    status VARCHAR(50) DEFAULT 'Pending',
    city VARCHAR(255),
    contact_email VARCHAR(255) UNIQUE NOT NULL,
    active_promo_count INTEGER DEFAULT 0,
    mrr_contribution DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES app.businesses(id),
    headline VARCHAR(255) NOT NULL,
    broadcast_radius INTEGER NOT NULL,
    redemption_count INTEGER DEFAULT 0,
    redemption_limit INTEGER,
    status VARCHAR(50) DEFAULT 'Pending Approval',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    organizer_id UUID REFERENCES app.businesses(id),
    is_community BOOLEAN DEFAULT false,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    vibe_tags JSONB DEFAULT '[]',
    estimated_reach INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pending Review',
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    subject_id UUID NOT NULL, -- Could be user, business, or promo
    subject_type VARCHAR(50) NOT NULL,
    report_count INTEGER DEFAULT 1,
    summary TEXT,
    status VARCHAR(50) DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Admin Schema
CREATE TABLE IF NOT EXISTS admin.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT false,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'OPS', 'FINANCE')),
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS admin.platform_config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES admin.users(id)
);

-- 5. Audit Schema (Partitioned Table)
CREATE TABLE IF NOT EXISTS audit.entries (
    id UUID DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    admin_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    subject_id VARCHAR(255),
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partition for current month
CREATE TABLE IF NOT EXISTS audit.entries_y2026m04 PARTITION OF audit.entries
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- Create partition for next month
CREATE TABLE IF NOT EXISTS audit.entries_y2026m05 PARTITION OF audit.entries
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- 6. Insert-Only Role Setup
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_writer') THEN
        CREATE ROLE audit_writer NOLOGIN;
    END IF;
END
$$;
GRANT USAGE ON SCHEMA audit TO audit_writer;
GRANT INSERT ON audit.entries TO audit_writer;
-- Revoke all to be safe, then grant insert
REVOKE ALL ON audit.entries FROM audit_writer;
GRANT INSERT ON audit.entries TO audit_writer;

-- 7. Partition Maintenance Function
CREATE OR REPLACE FUNCTION audit.create_audit_partitions(months_ahead INT) RETURNS void AS $$
DECLARE
    current_date DATE := date_trunc('month', NOW());
    target_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    FOR i IN 0..months_ahead LOOP
        target_date := current_date + (i || ' month')::interval;
        partition_name := 'entries_y' || to_char(target_date, 'YYYY') || 'm' || to_char(target_date, 'MM');
        start_date := to_char(target_date, 'YYYY-MM-01');
        end_date := to_char(target_date + '1 month'::interval, 'YYYY-MM-01');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS audit.%I PARTITION OF audit.entries FOR VALUES FROM (%L) TO (%L);',
            partition_name, start_date, end_date
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create partitions for the next 12 months
SELECT audit.create_audit_partitions(12);
