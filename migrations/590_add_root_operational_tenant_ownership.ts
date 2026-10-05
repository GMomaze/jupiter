'use strict';

import { DataTypes, QueryInterface, QueryTypes, Transaction } from 'sequelize';

const ROOT_TABLES = [
  'aircraft',
  'customers',
  'serialized_components',
  'planning_sessions',
  'workpacks',
] as const;

const IMMUTABILITY_FUNCTION = 'fn_root_operational_tenant_ownership_immutable';

const TRIGGERS = [
  ['aircraft', 'tr_aircraft_tenant_immutable', 'tenant_id'],
  ['customers', 'tr_customers_tenant_immutable', 'tenant_id'],
  [
    'serialized_components',
    'tr_serialized_components_custodian_tenant_immutable',
    'custodian_tenant_id',
  ],
  ['planning_sessions', 'tr_planning_sessions_tenant_immutable', 'tenant_id'],
  ['workpacks', 'tr_workpacks_tenant_immutable', 'tenant_id'],
] as const;

async function tableExists(queryInterface: QueryInterface, table: string) {
  return Boolean(await queryInterface.describeTable(table).catch(() => null));
}

async function assertEmptyRoot(
  queryInterface: QueryInterface,
  table: (typeof ROOT_TABLES)[number],
  transaction: Transaction
) {
  const [result] = await queryInterface.sequelize.query<{ has_rows: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM public.${table} LIMIT 1) AS has_rows;`,
    { type: QueryTypes.SELECT, transaction }
  );

  if (result?.has_rows) {
    throw new Error(`ROOT_OPERATIONAL_OWNERSHIP_REQUIRES_EMPTY_${table.toUpperCase()}`);
  }
}

async function assertEmptyRootForDown(
  queryInterface: QueryInterface,
  table: (typeof ROOT_TABLES)[number],
  transaction: Transaction
) {
  const [result] = await queryInterface.sequelize.query<{ has_rows: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM public.${table} LIMIT 1) AS has_rows;`,
    { type: QueryTypes.SELECT, transaction }
  );

  if (result?.has_rows) {
    throw new Error(
      `ROOT_OPERATIONAL_OWNERSHIP_DOWN_REQUIRES_EMPTY_${table.toUpperCase()}`
    );
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    for (const prerequisite of ['tenants', ...ROOT_TABLES]) {
      if (!(await tableExists(queryInterface, prerequisite))) {
        throw new Error(`${prerequisite.toUpperCase()}_TABLE_REQUIRED`);
      }
    }

    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        `LOCK TABLE ${ROOT_TABLES.map(table => `public.${table}`).join(', ')}
           IN ACCESS EXCLUSIVE MODE;`,
        { transaction }
      );

      for (const table of ROOT_TABLES) {
        await assertEmptyRoot(queryInterface, table, transaction);
      }

      for (const table of ['aircraft', 'customers', 'planning_sessions', 'workpacks']) {
        await queryInterface.addColumn(
          table,
          'tenant_id',
          {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'tenants', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          { transaction }
        );
      }

      await queryInterface.addColumn(
        'serialized_components',
        'custodian_tenant_id',
        {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'tenants', key: 'id' },
          onUpdate: 'RESTRICT',
          onDelete: 'RESTRICT',
        },
        { transaction }
      );

      await queryInterface.removeConstraint('aircraft', 'aircraft_registration_key', {
        transaction,
      });
      await queryInterface.removeIndex('customers', 'customers_account_reference_unique', {
        transaction,
      });
      await queryInterface.removeConstraint('workpacks', 'workpacks_work_order_number_key', {
        transaction,
      });

      await queryInterface.sequelize.query(
        `ALTER TABLE public.aircraft
           ADD CONSTRAINT aircraft_registration_nonblank_check
             CHECK (btrim(registration) <> '');
         ALTER TABLE public.customers
           ADD CONSTRAINT customers_account_reference_nonblank_check
             CHECK (account_reference IS NULL OR btrim(account_reference) <> '');
         ALTER TABLE public.workpacks
           ADD CONSTRAINT workpacks_work_order_number_nonblank_check
             CHECK (btrim(work_order_number) <> '');
         ALTER TABLE public.serialized_components
           ADD CONSTRAINT serialized_components_serial_number_nonblank_check
             CHECK (btrim(serial_number) <> '');

         CREATE UNIQUE INDEX aircraft_tenant_registration_normalized_unique
           ON public.aircraft (tenant_id, upper(btrim(registration)));
         CREATE UNIQUE INDEX customers_tenant_account_reference_normalized_unique
           ON public.customers (tenant_id, upper(btrim(account_reference)))
           WHERE account_reference IS NOT NULL AND btrim(account_reference) <> '';
         CREATE UNIQUE INDEX workpacks_tenant_work_order_number_normalized_unique
           ON public.workpacks (tenant_id, upper(btrim(work_order_number)));
         CREATE UNIQUE INDEX serialized_components_tenant_model_serial_normalized_unique
           ON public.serialized_components
             (custodian_tenant_id, component_model_id, upper(btrim(serial_number)));
         CREATE INDEX customers_tenant_id_index ON public.customers (tenant_id);
         CREATE INDEX planning_sessions_tenant_id_index
           ON public.planning_sessions (tenant_id);

         CREATE FUNCTION public.${IMMUTABILITY_FUNCTION}()
         RETURNS trigger
         LANGUAGE plpgsql
         AS $function$
         BEGIN
           IF (to_jsonb(NEW) ->> TG_ARGV[0]) IS DISTINCT FROM
              (to_jsonb(OLD) ->> TG_ARGV[0]) THEN
             RAISE EXCEPTION 'ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE';
           END IF;
           RETURN NEW;
         END;
         $function$;`,
        { transaction }
      );

      for (const [table, trigger, column] of TRIGGERS) {
        await queryInterface.sequelize.query(
          `CREATE TRIGGER ${trigger}
           BEFORE UPDATE ON public.${table}
           FOR EACH ROW
           EXECUTE FUNCTION public.${IMMUTABILITY_FUNCTION}('${column}');`,
          { transaction }
        );
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        `LOCK TABLE ${ROOT_TABLES.map(table => `public.${table}`).join(', ')}
           IN ACCESS EXCLUSIVE MODE;`,
        { transaction }
      );

      for (const table of ROOT_TABLES) {
        await assertEmptyRootForDown(queryInterface, table, transaction);
      }

      const duplicateChecks = [
        ['aircraft', 'registration'],
        ['customers', 'account_reference'],
        ['workpacks', 'work_order_number'],
      ] as const;

      for (const [table, column] of duplicateChecks) {
        const [result] = await queryInterface.sequelize.query<{ has_duplicates: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM public.${table}
             WHERE ${column} IS NOT NULL
             GROUP BY ${column}
             HAVING count(*) > 1
           ) AS has_duplicates;`,
          { type: QueryTypes.SELECT, transaction }
        );
        if (result?.has_duplicates) {
          throw new Error(
            `ROOT_OPERATIONAL_OWNERSHIP_DOWN_GLOBAL_UNIQUENESS_CONFLICT_${table.toUpperCase()}`
          );
        }
      }

      for (const [table, trigger] of TRIGGERS) {
        await queryInterface.sequelize.query(
          `DROP TRIGGER IF EXISTS ${trigger} ON public.${table};`,
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `DROP FUNCTION IF EXISTS public.${IMMUTABILITY_FUNCTION}();
         DROP INDEX IF EXISTS public.aircraft_tenant_registration_normalized_unique;
         DROP INDEX IF EXISTS public.customers_tenant_account_reference_normalized_unique;
         DROP INDEX IF EXISTS public.workpacks_tenant_work_order_number_normalized_unique;
         DROP INDEX IF EXISTS public.serialized_components_tenant_model_serial_normalized_unique;
         DROP INDEX IF EXISTS public.customers_tenant_id_index;
         DROP INDEX IF EXISTS public.planning_sessions_tenant_id_index;
         ALTER TABLE public.aircraft
           DROP CONSTRAINT IF EXISTS aircraft_registration_nonblank_check;
         ALTER TABLE public.customers
           DROP CONSTRAINT IF EXISTS customers_account_reference_nonblank_check;
         ALTER TABLE public.workpacks
           DROP CONSTRAINT IF EXISTS workpacks_work_order_number_nonblank_check;
         ALTER TABLE public.serialized_components
           DROP CONSTRAINT IF EXISTS serialized_components_serial_number_nonblank_check;`,
        { transaction }
      );

      await queryInterface.removeColumn('aircraft', 'tenant_id', { transaction });
      await queryInterface.removeColumn('customers', 'tenant_id', { transaction });
      await queryInterface.removeColumn('serialized_components', 'custodian_tenant_id', {
        transaction,
      });
      await queryInterface.removeColumn('planning_sessions', 'tenant_id', { transaction });
      await queryInterface.removeColumn('workpacks', 'tenant_id', { transaction });

      await queryInterface.addConstraint('aircraft', {
        fields: ['registration'],
        type: 'unique',
        name: 'aircraft_registration_key',
        transaction,
      });
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX customers_account_reference_unique
           ON public.customers (account_reference)
           WHERE account_reference IS NOT NULL;`,
        { transaction }
      );
      await queryInterface.addConstraint('workpacks', {
        fields: ['work_order_number'],
        type: 'unique',
        name: 'workpacks_work_order_number_key',
        transaction,
      });
    });
  },
};
