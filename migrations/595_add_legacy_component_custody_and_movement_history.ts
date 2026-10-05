import type { QueryInterface } from 'sequelize';

const HISTORY_TABLE = 'aircraft_component_movement_history';

export default {
  async up(queryInterface: QueryInterface) {
    const components = await queryInterface.describeTable('aircraft_components').catch(() => null);
    const aircraft = await queryInterface.describeTable('aircraft').catch(() => null);
    const tenants = await queryInterface.describeTable('tenants').catch(() => null);
    if (!components || !aircraft || !tenants) {
      throw new Error('MIGRATION_595_PREREQUISITE_MISSING');
    }

    await queryInterface.sequelize.transaction(async transaction => {
      const [preflight] = await queryInterface.sequelize.query(
        `SELECT
           COUNT(*) FILTER (WHERE ac.aircraft_id IS NULL OR a.id IS NULL) AS invalid_aircraft_links,
           COUNT(*) FILTER (WHERE a.id IS NOT NULL AND (a.tenant_id IS NULL OR t.id IS NULL)) AS invalid_aircraft_tenants,
           COUNT(*) FILTER (WHERE ac.current_status NOT IN ('INSTALLED', 'REMOVED', 'QUARANTINED')) AS invalid_statuses
         FROM public.aircraft_components ac
         LEFT JOIN public.aircraft a ON a.id = ac.aircraft_id
         LEFT JOIN public.tenants t ON t.id = a.tenant_id`,
        { transaction },
      ) as [Array<Record<string, string>>, unknown];
      const invalid = preflight[0];
      if (!invalid || Object.values(invalid).some(value => Number(value) !== 0)) {
        throw new Error('MIGRATION_595_CUSTODY_BACKFILL_UNRESOLVED');
      }

      const [duplicates] = await queryInterface.sequelize.query(
        `SELECT 1
           FROM public.aircraft_components ac
           JOIN public.aircraft a ON a.id = ac.aircraft_id
          GROUP BY a.tenant_id, ac.model_id, upper(btrim(ac.serial_number))
         HAVING COUNT(*) > 1
          LIMIT 1`,
        { transaction },
      ) as [unknown[], unknown];
      if (duplicates.length) throw new Error('MIGRATION_595_DUPLICATE_COMPONENT_IDENTITY');

      await queryInterface.sequelize.query(
        `ALTER TABLE public.aircraft_components
           ADD COLUMN custodian_tenant_id UUID;

         UPDATE public.aircraft_components component
            SET custodian_tenant_id = aircraft.tenant_id
           FROM public.aircraft aircraft
          WHERE aircraft.id = component.aircraft_id;

         DO $$ BEGIN
           IF EXISTS (SELECT 1 FROM public.aircraft_components WHERE custodian_tenant_id IS NULL) THEN
             RAISE EXCEPTION 'MIGRATION_595_CUSTODY_BACKFILL_UNRESOLVED';
           END IF;
         END $$;

         ALTER TABLE public.aircraft_components
           ALTER COLUMN custodian_tenant_id SET NOT NULL,
           ADD CONSTRAINT aircraft_components_custodian_tenant_id_fkey
             FOREIGN KEY (custodian_tenant_id) REFERENCES public.tenants(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT;

         CREATE INDEX aircraft_components_custodian_tenant_id_index
           ON public.aircraft_components(custodian_tenant_id);
         CREATE UNIQUE INDEX aircraft_components_tenant_model_serial_normalized_unique
           ON public.aircraft_components
             (custodian_tenant_id, model_id, upper(btrim(serial_number)));

         CREATE FUNCTION public.enforce_aircraft_component_custody()
         RETURNS trigger LANGUAGE plpgsql AS $$
         DECLARE aircraft_tenant UUID;
         BEGIN
           IF TG_OP = 'UPDATE' AND NEW.custodian_tenant_id IS DISTINCT FROM OLD.custodian_tenant_id THEN
             RAISE EXCEPTION 'AIRCRAFT_COMPONENT_CUSTODY_IMMUTABLE';
           END IF;
           SELECT tenant_id INTO aircraft_tenant FROM public.aircraft WHERE id = NEW.aircraft_id;
           IF aircraft_tenant IS NULL OR aircraft_tenant IS DISTINCT FROM NEW.custodian_tenant_id THEN
             RAISE EXCEPTION 'AIRCRAFT_COMPONENT_CUSTODY_AIRCRAFT_TENANT_MISMATCH';
           END IF;
           RETURN NEW;
         END $$;
         CREATE TRIGGER tr_aircraft_component_custody
           BEFORE INSERT OR UPDATE OF custodian_tenant_id, aircraft_id, current_status
           ON public.aircraft_components
           FOR EACH ROW EXECUTE FUNCTION public.enforce_aircraft_component_custody();

         CREATE TABLE public.${HISTORY_TABLE} (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           aircraft_component_id UUID NOT NULL REFERENCES public.aircraft_components(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT,
           tenant_id UUID NOT NULL REFERENCES public.tenants(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT,
           action_type TEXT NOT NULL CHECK (action_type IN ('INSTALLATION', 'REMOVAL')),
           source_aircraft_id UUID NULL REFERENCES public.aircraft(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT,
           target_aircraft_id UUID NULL REFERENCES public.aircraft(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT,
           actor_id UUID NOT NULL REFERENCES public.users(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT,
           occurred_at TIMESTAMPTZ NOT NULL,
           aircraft_hours DECIMAL(12,2) NULL,
           remarks TEXT NULL,
           CONSTRAINT aircraft_component_movement_direction_check CHECK (
             (action_type = 'REMOVAL' AND source_aircraft_id IS NOT NULL AND target_aircraft_id IS NULL)
             OR
             (action_type = 'INSTALLATION' AND target_aircraft_id IS NOT NULL AND source_aircraft_id IS NULL)
           )
         );
         CREATE INDEX aircraft_component_movement_component_time_index
           ON public.${HISTORY_TABLE}(aircraft_component_id, occurred_at DESC);
         CREATE INDEX aircraft_component_movement_tenant_time_index
           ON public.${HISTORY_TABLE}(tenant_id, occurred_at DESC);
         CREATE INDEX aircraft_component_movement_source_aircraft_index
           ON public.${HISTORY_TABLE}(source_aircraft_id) WHERE source_aircraft_id IS NOT NULL;
         CREATE INDEX aircraft_component_movement_target_aircraft_index
           ON public.${HISTORY_TABLE}(target_aircraft_id) WHERE target_aircraft_id IS NOT NULL;

         CREATE FUNCTION public.reject_aircraft_component_movement_mutation()
         RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN
           RAISE EXCEPTION 'AIRCRAFT_COMPONENT_MOVEMENT_HISTORY_IMMUTABLE';
         END $$;
         CREATE TRIGGER tr_aircraft_component_movement_immutable
           BEFORE UPDATE OR DELETE ON public.${HISTORY_TABLE}
           FOR EACH ROW EXECUTE FUNCTION public.reject_aircraft_component_movement_mutation();

         REVOKE ALL ON TABLE public.${HISTORY_TABLE} FROM PUBLIC;
         GRANT SELECT, INSERT ON TABLE public.${HISTORY_TABLE} TO jupiter_app, jupiter_test;`,
        { transaction },
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT
           EXISTS (SELECT 1 FROM public.aircraft_components) AS has_components,
           EXISTS (SELECT 1 FROM public.${HISTORY_TABLE}) AS has_history`,
        { transaction },
      ) as [Array<{ has_components: boolean; has_history: boolean }>, unknown];
      if (rows[0]?.has_components || rows[0]?.has_history) {
        throw new Error('MIGRATION_595_POPULATED_DATA_PREVENTS_ROLLBACK');
      }
      await queryInterface.sequelize.query(
        `DROP TABLE public.${HISTORY_TABLE};
         DROP FUNCTION public.reject_aircraft_component_movement_mutation();
         DROP TRIGGER tr_aircraft_component_custody ON public.aircraft_components;
         DROP FUNCTION public.enforce_aircraft_component_custody();
         DROP INDEX public.aircraft_components_tenant_model_serial_normalized_unique;
         DROP INDEX public.aircraft_components_custodian_tenant_id_index;
         ALTER TABLE public.aircraft_components
           DROP CONSTRAINT aircraft_components_custodian_tenant_id_fkey,
           DROP COLUMN custodian_tenant_id;`,
        { transaction },
      );
    });
  },
};
