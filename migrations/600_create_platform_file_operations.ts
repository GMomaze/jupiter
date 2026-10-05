import { QueryInterface, QueryTypes } from 'sequelize';

export default {
  async up(q: QueryInterface) {
    const [state]: any = await q.sequelize.query(`SELECT
      to_regclass('public.platform_principals') IS NOT NULL principals,
      to_regclass('public.platform_global_audit_log') IS NOT NULL audit,
      to_regclass('public.platform_file_operations') IS NOT NULL journal`, { type: QueryTypes.SELECT });
    if (!state?.principals || !state?.audit) throw new Error('MIGRATION_600_REQUIRES_VERIFIED_PLATFORM_FOUNDATION');
    if (state.journal) throw new Error('MIGRATION_600_REFUSES_EXISTING_JOURNAL');
    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query(`CREATE TABLE platform_file_operations (
        id uuid PRIMARY KEY,
        correlation_id uuid NOT NULL UNIQUE,
        principal_id uuid NOT NULL REFERENCES platform_principals(id) ON DELETE RESTRICT,
        operation_kind varchar(32) NOT NULL CHECK (operation_kind IN ('PROMOTION','REPLACEMENT','EPHEMERAL_IMPORT')),
        state varchar(32) NOT NULL CHECK (state IN ('PREPARED','VALIDATED','PROMOTING','PROMOTED','COMMITTED','CLEANUP_REQUIRED','CLEANED','FAILED')),
        quarantine_root_key varchar(64) NOT NULL CHECK (quarantine_root_key IN ('MANUFACTURER_QUARANTINE','SB_IMPORT_QUARANTINE')),
        destination_root_key varchar(64) NOT NULL CHECK (destination_root_key IN ('MANUFACTURER_PUBLIC','SB_IMPORT_EPHEMERAL')),
        quarantine_name varchar(255) NOT NULL,
        destination_name varchar(255),
        previous_name varchar(255),
        original_name varchar(255),
        declared_mime varchar(128),
        detected_media_type varchar(32),
        content_sha256 varchar(64),
        size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
        resource_type varchar(120),
        resource_id uuid,
        failure_code varchar(120),
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at timestamptz,
        CONSTRAINT platform_file_operation_names CHECK (
          quarantine_name !~ '[\\/]' AND quarantine_name !~ '\\.\\.' AND
          (destination_name IS NULL OR (destination_name !~ '[\\/]' AND destination_name !~ '\\.\\.')) AND
          (previous_name IS NULL OR (previous_name !~ '[\\/]' AND previous_name !~ '\\.\\.'))
        ),
        CONSTRAINT platform_file_operation_state_shape CHECK (
          (state = 'PREPARED' AND detected_media_type IS NULL AND content_sha256 IS NULL) OR
          (state IN ('VALIDATED','PROMOTING','PROMOTED','COMMITTED') AND detected_media_type IS NOT NULL AND content_sha256 IS NOT NULL AND size_bytes IS NOT NULL) OR
          state IN ('CLEANUP_REQUIRED','CLEANED','FAILED')
        )
      )`, { transaction });
      await q.sequelize.query(`CREATE INDEX platform_file_operations_recovery_idx
        ON platform_file_operations(state, updated_at, id)
        WHERE state NOT IN ('COMMITTED','CLEANED')`, { transaction });
    });
  },

  async down(q: QueryInterface) {
    const exists: any[] = await q.sequelize.query(`SELECT to_regclass('public.platform_file_operations') name`, { type: QueryTypes.SELECT });
    if (!exists[0]?.name) return;
    const rows: any[] = await q.sequelize.query(`SELECT count(*)::int count FROM platform_file_operations`, { type: QueryTypes.SELECT });
    if (rows[0]?.count) throw new Error('MIGRATION_600_DOWN_REFUSES_FILE_OPERATION_EVIDENCE');
    await q.sequelize.transaction(transaction => q.sequelize.query('DROP TABLE platform_file_operations', { transaction }));
  },
};
