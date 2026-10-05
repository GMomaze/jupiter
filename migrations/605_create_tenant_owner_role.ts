'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER_ROLE = 'jupiter_tenant_owner';

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Idempotent creation with the exact required safe attributes.
      await queryInterface.sequelize.query(
        `DO $$
         BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${OWNER_ROLE}') THEN
             CREATE ROLE ${OWNER_ROLE}
               NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
           END IF;
         END $$;`,
        { transaction }
      );

      // Enforce exact attributes even if the role pre-existed.
      await queryInterface.sequelize.query(
        `ALTER ROLE ${OWNER_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;`,
        { transaction }
      );

      // Verify exact attributes and zero memberships.
      const [verified] = await queryInterface.sequelize.query<{
        nologin: boolean;
        nosuperuser: boolean;
        nocreatedb: boolean;
        nocreaterole: boolean;
        noreplication: boolean;
        nobypassrls: boolean;
        noinherit: boolean;
        membership_links: number;
      }>(
        `SELECT
           NOT rolcanlogin AS nologin,
           NOT rolsuper AS nosuperuser,
           NOT rolcreatedb AS nocreatedb,
           NOT rolcreaterole AS nocreaterole,
           NOT rolreplication AS noreplication,
           NOT rolbypassrls AS nobypassrls,
           NOT rolinherit AS noinherit,
           (SELECT count(*)::int FROM pg_catalog.pg_auth_members m
              WHERE m.member = r.oid OR m.roleid = r.oid) AS membership_links
         FROM pg_catalog.pg_roles r
         WHERE r.rolname = :owner`,
        { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT, transaction }
      );

      if (
        !verified ||
        !verified.nologin ||
        !verified.nosuperuser ||
        !verified.nocreatedb ||
        !verified.nocreaterole ||
        !verified.noreplication ||
        !verified.nobypassrls ||
        !verified.noinherit ||
        verified.membership_links !== 0
      ) {
        throw new Error('TENANT_OWNER_ROLE_UNSAFE');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [state] = await queryInterface.sequelize.query<{
        exists: boolean;
        owned_relations: number;
        owned_functions: number;
        memberships: number;
        granted_to: number;
      }>(
        `SELECT
           EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :owner) AS exists,
           (SELECT count(*)::int FROM pg_catalog.pg_class c
              JOIN pg_catalog.pg_roles r ON r.oid = c.relowner WHERE r.rolname = :owner) AS owned_relations,
           (SELECT count(*)::int FROM pg_catalog.pg_proc p
              JOIN pg_catalog.pg_roles r ON r.oid = p.proowner WHERE r.rolname = :owner) AS owned_functions,
           (SELECT count(*)::int FROM pg_catalog.pg_auth_members m
              JOIN pg_catalog.pg_roles r ON r.oid = m.member WHERE r.rolname = :owner) AS memberships,
           (SELECT count(*)::int FROM pg_catalog.pg_auth_members m
              JOIN pg_catalog.pg_roles r ON r.oid = m.roleid WHERE r.rolname = :owner) AS granted_to`,
        { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT, transaction }
      );

      if (!state?.exists) return;
      if (
        state.owned_relations > 0 ||
        state.owned_functions > 0 ||
        state.memberships > 0 ||
        state.granted_to > 0
      ) {
        throw new Error('TENANT_OWNER_ROLE_DOWN_REFUSED');
      }
      await queryInterface.sequelize.query(`DROP ROLE ${OWNER_ROLE};`, { transaction });
    });
  },
};
