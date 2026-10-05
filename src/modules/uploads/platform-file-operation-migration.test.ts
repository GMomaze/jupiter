import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
const migration=fs.readFileSync('migrations/600_create_platform_file_operations.ts','utf8');
describe('migration 600 platform file-operation journal contract',()=>{
  it('is additive, foundation-guarded, and creates no authority',()=>{expect(migration).toContain('CREATE TABLE platform_file_operations');expect(migration).toContain('MIGRATION_600_REQUIRES_VERIFIED_PLATFORM_FOUNDATION');expect(migration).not.toMatch(/INSERT INTO platform_(principals|capabilities|capability_grants)/);});
  it('defines fixed lifecycle, identity, root-key and basename metadata',()=>{for(const value of ['PREPARED','VALIDATED','PROMOTING','PROMOTED','COMMITTED','CLEANUP_REQUIRED','CLEANED','FAILED','correlation_id','principal_id','quarantine_root_key','destination_root_key','quarantine_name','destination_name','content_sha256'])expect(migration).toContain(value);});
  it('refuses populated DOWN and indexes bounded recovery',()=>{expect(migration).toContain('MIGRATION_600_DOWN_REFUSES_FILE_OPERATION_EVIDENCE');expect(migration).toContain('platform_file_operations_recovery_idx');expect(migration).toContain("state NOT IN ('COMMITTED','CLEANED')");});
});
