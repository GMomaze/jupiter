BEGIN;

-- ============================================================
-- 0.1 ENSURE FK: component_models.asset_type_id → rf_asset_type(id)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'component_models_asset_type_fk'
    ) THEN
        ALTER TABLE component_models
        ADD CONSTRAINT component_models_asset_type_fk
        FOREIGN KEY (asset_type_id)
        REFERENCES rf_asset_type(id)
        ON DELETE RESTRICT;
    END IF;
END
$$;

-- ============================================================
-- 0.2 REMOVE CASCADE FROM manufacturer_id
-- ============================================================

DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT tc.constraint_name
    INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'component_models'
      AND kcu.column_name = 'manufacturer_id'
      AND tc.constraint_type = 'FOREIGN KEY';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE component_models DROP CONSTRAINT %I', constraint_name);
    END IF;

    ALTER TABLE component_models
    ADD CONSTRAINT component_models_manufacturer_fk
    FOREIGN KEY (manufacturer_id)
    REFERENCES manufacturers(id)
    ON DELETE RESTRICT;
END
$$;

-- ============================================================
-- 0.3 ADD LIFECYCLE COLUMN
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'component_models'
          AND column_name = 'is_active'
    ) THEN
        ALTER TABLE component_models
        ADD COLUMN is_active boolean DEFAULT true;
    END IF;
END
$$;

COMMIT;