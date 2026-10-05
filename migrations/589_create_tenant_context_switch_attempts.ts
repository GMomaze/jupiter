'use strict';

import { DataTypes, QueryInterface, literal } from 'sequelize';

const TABLE = 'tenant_context_switch_attempts';
const TRANSITION_FUNCTION = 'fn_tenant_context_switch_attempts_guard_transition';
const TRANSITION_TRIGGER = 'tr_tenant_context_switch_attempts_guard_transition';

async function tableExists(queryInterface: QueryInterface, table: string) {
  return Boolean(await queryInterface.describeTable(table).catch(() => null));
}

export default {
  async up(queryInterface: QueryInterface) {
    for (const prerequisite of [
      'users',
      'tenants',
      'tenant_memberships',
      'audit_log',
    ]) {
      if (!(await tableExists(queryInterface, prerequisite))) {
        throw new Error(`${prerequisite.toUpperCase()}_TABLE_REQUIRED`);
      }
    }
    if (await tableExists(queryInterface, TABLE)) {
      throw new Error('TENANT_CONTEXT_SWITCH_ATTEMPTS_TABLE_ALREADY_EXISTS');
    }

    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        TABLE,
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: literal('gen_random_uuid()'),
          },
          actor_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          previous_tenant_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'tenants', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          previous_membership_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'tenant_memberships', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          target_tenant_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'tenants', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          target_membership_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'tenant_memberships', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          state: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: 'PENDING',
          },
          rejection_reason: { type: DataTypes.STRING(40), allowNull: true },
          failure_category: { type: DataTypes.STRING(30), allowNull: true },
          rejected_target_fingerprint: {
            type: DataTypes.STRING(43),
            allowNull: true,
          },
          rejected_input_length: { type: DataTypes.SMALLINT, allowNull: true },
          rejected_input_length_capped: { type: DataTypes.BOOLEAN, allowNull: true },
          request_correlation_hash: {
            type: DataTypes.STRING(43),
            allowNull: false,
          },
          previous_session_correlation_hash: {
            type: DataTypes.STRING(43),
            allowNull: true,
          },
          regenerated_session_correlation_hash: {
            type: DataTypes.STRING(43),
            allowNull: true,
          },
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: literal('CURRENT_TIMESTAMP'),
          },
          finalized_at: { type: DataTypes.DATE, allowNull: true },
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE public.tenant_context_switch_attempts
           ADD CONSTRAINT tenant_context_switch_attempts_state_check
             CHECK (state IN ('PENDING', 'SWITCHED', 'REJECTED', 'FAILED')),
           ADD CONSTRAINT tenant_context_switch_attempts_target_pair_check
             CHECK ((target_tenant_id IS NULL) = (target_membership_id IS NULL)),
           ADD CONSTRAINT tenant_context_switch_attempts_rejection_reason_check
             CHECK (rejection_reason IS NULL OR rejection_reason IN (
               'ORGANISATION_UNAVAILABLE', 'SAME_ORGANISATION',
               'STALE_REQUEST', 'CONCURRENT_REQUEST_LOST'
             )),
           ADD CONSTRAINT tenant_context_switch_attempts_failure_category_check
             CHECK (failure_category IS NULL OR failure_category IN (
               'SESSION_PERSISTENCE', 'AUDIT_PERSISTENCE', 'INTERNAL'
             )),
           ADD CONSTRAINT tenant_context_switch_attempts_request_hash_check
             CHECK (request_correlation_hash ~ '^[A-Za-z0-9_-]{43}$'),
           ADD CONSTRAINT tenant_context_switch_attempts_previous_session_hash_check
             CHECK (previous_session_correlation_hash IS NULL OR
               previous_session_correlation_hash ~ '^[A-Za-z0-9_-]{43}$'),
           ADD CONSTRAINT tenant_context_switch_attempts_regenerated_session_hash_check
             CHECK (regenerated_session_correlation_hash IS NULL OR
               regenerated_session_correlation_hash ~ '^[A-Za-z0-9_-]{43}$'),
           ADD CONSTRAINT tenant_context_switch_attempts_rejected_fingerprint_check
             CHECK (rejected_target_fingerprint IS NULL OR
               rejected_target_fingerprint ~ '^[A-Za-z0-9_-]{43}$'),
           ADD CONSTRAINT tenant_context_switch_attempts_rejected_length_check
             CHECK (rejected_input_length IS NULL OR
               rejected_input_length BETWEEN 0 AND 256),
           ADD CONSTRAINT tenant_context_switch_attempts_rejected_shape_check
             CHECK (
               (rejected_target_fingerprint IS NULL
                 AND rejected_input_length IS NULL
                 AND rejected_input_length_capped IS NULL
                 AND rejection_reason IS NULL)
               OR
               (rejected_target_fingerprint IS NOT NULL
                 AND rejected_input_length IS NOT NULL
                 AND rejected_input_length_capped IS NOT NULL
                 AND rejection_reason IS NOT NULL)
             ),
           ADD CONSTRAINT tenant_context_switch_attempts_state_shape_check
             CHECK (
               (state = 'PENDING' AND finalized_at IS NULL AND failure_category IS NULL)
               OR
               (state = 'SWITCHED' AND finalized_at IS NOT NULL
                 AND target_tenant_id IS NOT NULL AND rejection_reason IS NULL
                 AND failure_category IS NULL
                 AND regenerated_session_correlation_hash IS NOT NULL)
               OR
               (state = 'REJECTED' AND finalized_at IS NOT NULL
                 AND rejected_target_fingerprint IS NOT NULL
                 AND failure_category IS NULL)
               OR
               (state = 'FAILED' AND finalized_at IS NOT NULL
                 AND failure_category IS NOT NULL)
             ),
           ADD CONSTRAINT tenant_context_switch_attempts_finalized_date_check
             CHECK (finalized_at IS NULL OR finalized_at >= created_at),
           ADD CONSTRAINT tenant_context_switch_attempts_actor_request_unique
             UNIQUE (actor_user_id, request_correlation_hash);`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX tenant_context_switch_attempts_actor_created_index
           ON public.tenant_context_switch_attempts (actor_user_id, created_at DESC);
         CREATE INDEX tenant_context_switch_attempts_pending_index
           ON public.tenant_context_switch_attempts (created_at)
           WHERE state = 'PENDING';

         CREATE FUNCTION public.${TRANSITION_FUNCTION}()
         RETURNS trigger
         LANGUAGE plpgsql
         AS $function$
         BEGIN
           IF OLD.state <> 'PENDING' THEN
             RAISE EXCEPTION 'TENANT_CONTEXT_SWITCH_ATTEMPT_FINAL_IMMUTABLE';
           END IF;
           IF NEW.state NOT IN ('SWITCHED', 'REJECTED', 'FAILED') THEN
             RAISE EXCEPTION 'TENANT_CONTEXT_SWITCH_ATTEMPT_TRANSITION_INVALID';
           END IF;
           IF NEW.id IS DISTINCT FROM OLD.id
              OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
              OR NEW.previous_tenant_id IS DISTINCT FROM OLD.previous_tenant_id
              OR NEW.previous_membership_id IS DISTINCT FROM OLD.previous_membership_id
              OR NEW.target_tenant_id IS DISTINCT FROM OLD.target_tenant_id
              OR NEW.target_membership_id IS DISTINCT FROM OLD.target_membership_id
              OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
              OR NEW.rejected_target_fingerprint IS DISTINCT FROM OLD.rejected_target_fingerprint
              OR NEW.rejected_input_length IS DISTINCT FROM OLD.rejected_input_length
              OR NEW.rejected_input_length_capped IS DISTINCT FROM OLD.rejected_input_length_capped
              OR NEW.request_correlation_hash IS DISTINCT FROM OLD.request_correlation_hash
              OR NEW.previous_session_correlation_hash IS DISTINCT FROM OLD.previous_session_correlation_hash
              OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
             RAISE EXCEPTION 'TENANT_CONTEXT_SWITCH_ATTEMPT_ATTRIBUTION_IMMUTABLE';
           END IF;
           IF NEW.state <> 'SWITCHED'
              AND NEW.regenerated_session_correlation_hash IS DISTINCT FROM OLD.regenerated_session_correlation_hash THEN
             RAISE EXCEPTION 'TENANT_CONTEXT_SWITCH_ATTEMPT_SESSION_CORRELATION_INVALID';
           END IF;
           IF NEW.state <> 'FAILED'
              AND NEW.failure_category IS DISTINCT FROM OLD.failure_category THEN
             RAISE EXCEPTION 'TENANT_CONTEXT_SWITCH_ATTEMPT_FAILURE_CATEGORY_INVALID';
           END IF;
           RETURN NEW;
         END;
         $function$;

         CREATE TRIGGER ${TRANSITION_TRIGGER}
         BEFORE UPDATE ON public.tenant_context_switch_attempts
         FOR EACH ROW
         EXECUTE FUNCTION public.${TRANSITION_FUNCTION}();`,
        { transaction },
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    const exists = await tableExists(queryInterface, TABLE);
    await queryInterface.sequelize.transaction(async transaction => {
      if (exists) {
        await queryInterface.sequelize.query(
          `DROP TRIGGER IF EXISTS ${TRANSITION_TRIGGER}
             ON public.tenant_context_switch_attempts;`,
          { transaction },
        );
        await queryInterface.dropTable(TABLE, { transaction });
      }
      await queryInterface.sequelize.query(
        `DROP FUNCTION IF EXISTS public.${TRANSITION_FUNCTION}();`,
        { transaction },
      );
    });
  },
};
