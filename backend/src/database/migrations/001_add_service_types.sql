-- Migration: Add EXPRESS and STANDARD to service_type enum
-- This migration safely adds new enum values if they don't exist

DO $$
BEGIN
    -- Add EXPRESS if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'EXPRESS'
        AND enumtypid = 'service_type'::regtype
    ) THEN
        ALTER TYPE service_type ADD VALUE 'EXPRESS';
    END IF;

    -- Add STANDARD if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'STANDARD'
        AND enumtypid = 'service_type'::regtype
    ) THEN
        ALTER TYPE service_type ADD VALUE 'STANDARD';
    END IF;
END $$;
