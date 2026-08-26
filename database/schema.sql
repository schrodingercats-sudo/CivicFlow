-- CivicFlow Safe-Zone Tables in Public Schema (cf_ prefix)

-- Standard Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cf_user_role') THEN
        CREATE TYPE cf_user_role AS ENUM ('citizen', 'officer', 'admin', 'worker');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cf_complaint_category') THEN
        CREATE TYPE cf_complaint_category AS ENUM (
            'road_damage',
            'garbage',
            'street_lights',
            'drainage',
            'water_supply',
            'electricity',
            'traffic',
            'pollution',
            'public_property',
            'others'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cf_complaint_priority') THEN
        CREATE TYPE cf_complaint_priority AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cf_complaint_status') THEN
        CREATE TYPE cf_complaint_status AS ENUM (
            'submitted',
            'under_review',
            'assigned',
            'in_progress',
            'resolved',
            'closed',
            'rejected',
            'withdrawn'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cf_ai_processing_status') THEN
        CREATE TYPE cf_ai_processing_status AS ENUM ('pending', 'completed', 'failed');
    END IF;
END$$;

-- Trigger Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION cf_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS public.cf_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    category cf_complaint_category NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS public.cf_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE, -- Supabase Auth link
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    role cf_user_role NOT NULL DEFAULT 'citizen',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    department_id UUID REFERENCES public.cf_departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Complaints Table
CREATE TABLE IF NOT EXISTS public.cf_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category cf_complaint_category NOT NULL DEFAULT 'others',
    priority cf_complaint_priority NOT NULL DEFAULT 'medium',
    status cf_complaint_status NOT NULL DEFAULT 'submitted',
    
    -- Async AI Attributes
    ai_status cf_ai_processing_status NOT NULL DEFAULT 'pending',
    needs_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
    ai_summary TEXT,
    ai_suggested_response TEXT,
    ai_confidence NUMERIC(4, 2),
    
    -- Location Attributes
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    address TEXT NOT NULL,
    
    -- Media Attributes
    image_url TEXT,
    geo_image_url TEXT, -- GeoCam verified photo overlay

    -- Foreign Keys
    citizen_id UUID NOT NULL REFERENCES public.cf_users(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.cf_departments(id) ON DELETE SET NULL,
    assigned_officer_id UUID REFERENCES public.cf_users(id) ON DELETE SET NULL,
    assigned_worker_id UUID REFERENCES public.cf_users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Complaint Updates Table (Audit & Timeline)
CREATE TABLE IF NOT EXISTS public.cf_complaint_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.cf_complaints(id) ON DELETE CASCADE,
    updated_by UUID NOT NULL REFERENCES public.cf_users(id) ON DELETE CASCADE,
    old_status cf_complaint_status,
    new_status cf_complaint_status NOT NULL,
    remarks TEXT,
    proof_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Ratings Table
CREATE TABLE IF NOT EXISTS public.cf_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL UNIQUE REFERENCES public.cf_complaints(id) ON DELETE CASCADE,
    citizen_id UUID NOT NULL REFERENCES public.cf_users(id) ON DELETE CASCADE,
    rating_score INT CHECK (rating_score >= 1 AND rating_score <= 5),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS public.cf_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.cf_users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    link_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Worker Updates Table (Field Worker Progress)
CREATE TABLE IF NOT EXISTS public.cf_worker_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.cf_complaints(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.cf_users(id) ON DELETE CASCADE,
    update_type TEXT NOT NULL DEFAULT 'progress', -- accepted | in_progress | completed | progress
    remarks TEXT,
    proof_image_url TEXT,
    geo_image_url TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cf_complaints_status ON public.cf_complaints(status);
CREATE INDEX IF NOT EXISTS idx_cf_complaints_citizen ON public.cf_complaints(citizen_id);
CREATE INDEX IF NOT EXISTS idx_cf_complaints_dept ON public.cf_complaints(department_id);
CREATE INDEX IF NOT EXISTS idx_cf_complaints_category ON public.cf_complaints(category);
CREATE INDEX IF NOT EXISTS idx_cf_complaints_ai_status ON public.cf_complaints(ai_status);
CREATE INDEX IF NOT EXISTS idx_cf_complaints_worker ON public.cf_complaints(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_cf_updates_complaint ON public.cf_complaint_updates(complaint_id);
CREATE INDEX IF NOT EXISTS idx_cf_notifications_user ON public.cf_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_cf_notifications_created ON public.cf_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cf_worker_updates_complaint ON public.cf_worker_updates(complaint_id);
CREATE INDEX IF NOT EXISTS idx_cf_worker_updates_worker ON public.cf_worker_updates(worker_id);

-- Triggers
DROP TRIGGER IF EXISTS set_cf_departments_updated_at ON public.cf_departments;
CREATE TRIGGER set_cf_departments_updated_at BEFORE UPDATE ON public.cf_departments FOR EACH ROW EXECUTE FUNCTION cf_update_updated_at_column();

DROP TRIGGER IF EXISTS set_cf_users_updated_at ON public.cf_users;
CREATE TRIGGER set_cf_users_updated_at BEFORE UPDATE ON public.cf_users FOR EACH ROW EXECUTE FUNCTION cf_update_updated_at_column();

DROP TRIGGER IF EXISTS set_cf_complaints_updated_at ON public.cf_complaints;
CREATE TRIGGER set_cf_complaints_updated_at BEFORE UPDATE ON public.cf_complaints FOR EACH ROW EXECUTE FUNCTION cf_update_updated_at_column();
