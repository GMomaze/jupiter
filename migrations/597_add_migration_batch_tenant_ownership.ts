import type { QueryInterface } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface) {
    const batches = await queryInterface.describeTable('migration_batches').catch(() => null);
    const rows = await queryInterface.describeTable('migration_batch_rows').catch(() => null);
    const components = await queryInterface.describeTable('aircraft_components').catch(() => null);
    const aircraft = await queryInterface.describeTable('aircraft').catch(() => null);
    const tenants = await queryInterface.describeTable('tenants').catch(() => null);
    if (!batches || !rows || !components || !aircraft || !tenants) {
      throw new Error('MIGRATION_597_PREREQUISITE_MISSING');
    }
    if (batches.tenant_id) throw new Error('MIGRATION_597_TENANT_OWNERSHIP_ALREADY_EXISTS');

    await queryInterface.sequelize.transaction(async transaction => {
      const [unresolved] = await queryInterface.sequelize.query(
        `SELECT b.id
           FROM public.migration_batches b
           LEFT JOIN public.migration_batch_rows r ON r.batch_id = b.id
           LEFT JOIN public.aircraft_components ac
             ON r.source_table = 'aircraft_components' AND ac.id = r.source_row_id
           LEFT JOIN public.aircraft a ON a.id = ac.aircraft_id
          GROUP BY b.id
         HAVING COUNT(r.id) = 0
             OR COUNT(*) FILTER (
                  WHERE r.source_table <> 'aircraft_components'
                     OR ac.id IS NULL
                     OR a.id IS NULL
                     OR ac.custodian_tenant_id IS NULL
                     OR a.tenant_id IS DISTINCT FROM ac.custodian_tenant_id
                ) > 0
             OR COUNT(DISTINCT ac.custodian_tenant_id) <> 1
          LIMIT 1`,
        { transaction },
      ) as [unknown[], unknown];
      if (unresolved.length) {
        throw new Error('MIGRATION_597_HISTORICAL_BATCH_OWNERSHIP_UNRESOLVED');
      }

      await queryInterface.sequelize.query(
        `ALTER TABLE public.migration_batches ADD COLUMN tenant_id UUID;

         UPDATE public.migration_batches b
            SET tenant_id = resolved.tenant_id
           FROM (
             SELECT r.batch_id, MIN(ac.custodian_tenant_id::text)::uuid AS tenant_id
               FROM public.migration_batch_rows r
               JOIN public.aircraft_components ac
                 ON r.source_table = 'aircraft_components' AND ac.id = r.source_row_id
               JOIN public.aircraft a
                 ON a.id = ac.aircraft_id AND a.tenant_id = ac.custodian_tenant_id
              GROUP BY r.batch_id
           ) resolved
          WHERE resolved.batch_id = b.id;

         ALTER TABLE public.migration_batches
           ALTER COLUMN tenant_id SET NOT NULL,
           ADD CONSTRAINT migration_batches_tenant_id_fkey
             FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
             ON UPDATE RESTRICT ON DELETE RESTRICT;
         CREATE INDEX migration_batches_tenant_id_index
           ON public.migration_batches(tenant_id);

         CREATE FUNCTION public.enforce_migration_ledger_tenant_ownership()
         RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN
           IF TG_TABLE_NAME = 'migration_batches'
              AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
             RAISE EXCEPTION 'MIGRATION_BATCH_TENANT_IMMUTABLE';
           END IF;
           IF TG_TABLE_NAME = 'migration_batch_rows'
              AND NEW.batch_id IS DISTINCT FROM OLD.batch_id THEN
             RAISE EXCEPTION 'MIGRATION_BATCH_ROW_PARENT_IMMUTABLE';
           END IF;
           RETURN NEW;
         END $$;
         CREATE TRIGGER tr_migration_batch_tenant_immutable
           BEFORE UPDATE OF tenant_id ON public.migration_batches
           FOR EACH ROW EXECUTE FUNCTION public.enforce_migration_ledger_tenant_ownership();
         CREATE TRIGGER tr_migration_batch_row_parent_immutable
           BEFORE UPDATE OF batch_id ON public.migration_batch_rows
           FOR EACH ROW EXECUTE FUNCTION public.enforce_migration_ledger_tenant_ownership();`,
        { transaction },
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [populated] = await queryInterface.sequelize.query(
        'SELECT 1 FROM public.migration_batches LIMIT 1',
        { transaction },
      ) as [unknown[], unknown];
      if (populated.length) throw new Error('MIGRATION_597_POPULATED_LEDGER_PREVENTS_ROLLBACK');
      await queryInterface.sequelize.query(
        `DROP TRIGGER tr_migration_batch_row_parent_immutable ON public.migration_batch_rows;
         DROP TRIGGER tr_migration_batch_tenant_immutable ON public.migration_batches;
         DROP FUNCTION public.enforce_migration_ledger_tenant_ownership();
         DROP INDEX public.migration_batches_tenant_id_index;
         ALTER TABLE public.migration_batches
           DROP CONSTRAINT migration_batches_tenant_id_fkey,
           DROP COLUMN tenant_id;`,
        { transaction },
      );
    });
  },
};
