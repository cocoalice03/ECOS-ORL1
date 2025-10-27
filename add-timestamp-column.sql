-- Add timestamp column to exchanges table if it doesn't exist

-- Check and add timestamp column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'exchanges'
        AND column_name = 'timestamp'
    ) THEN
        ALTER TABLE public.exchanges ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added timestamp column to exchanges table';
    ELSE
        RAISE NOTICE 'timestamp column already exists in exchanges table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'exchanges'
ORDER BY ordinal_position;
