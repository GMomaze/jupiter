import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformServiceMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { scheduledSbSyncFiles } from '../uploads/service-bulletin-sync-file-boundary.js';
const read = (file: string) => readFileSync(file, 'utf8');

describe('L2-2D3 HUMAN/SERVICE SB synchronization boundary', () => {
  it('mounts HUMAN authority before CSRF, memory upload and handler', () => {
    expect(read('src/app.ts')).toContain("app.use('/sb', ensureAuthenticated, requireMountedHumanPlatformGate(platformAuthorityRepository, 'SB_SYNC'), serviceBulletinSyncRoutes)");
    expect(read('src/modules/service-bulletins/service-bulletin-sync.routes.ts')).toMatch(/'\/sync',\s*csrfProtection,\s*serviceBulletinImportUpload\.fields/);
    expect(read('src/middleware/upload.middleware.ts')).toMatch(/serviceBulletinImportUpload = multer\(\{\s*storage: multer\.memoryStorage\(\)/);
  });
  it('rejects client paths and passes only D1-issued files', () => {
    const route = read('src/modules/service-bulletins/service-bulletin-sync.routes.ts');
    expect(route).toContain('CLIENT_SB_SYNC_PATH_FORBIDDEN'); expect(route).not.toMatch(/veryonRootPath:|piperPdfPath:/);
    expect(route).toContain('runSbSyncFileMutation'); expect(route).toContain("requestPlatformMutationEvidence(req, ['SERVICE_BULLETIN_SYNC']");
  });
  it('uses the D1 private ephemeral lifecycle and always cleans inputs', () => {
    const boundary = read('src/modules/uploads/service-bulletin-sync-file-boundary.ts');
    for (const value of ["'SB_IMPORT_QUARANTINE'", "'SB_IMPORT_EPHEMERAL'", "'EPHEMERAL_IMPORT'", 'lifecycle.validate', 'lifecycle.promote', 'lifecycle.recover', 'finally']) expect(boundary).toContain(value);
    expect(boundary).not.toMatch(/destinationName\s*=.*originalname/);
  });
  it('closes direct bypass and couples lock, mutation, run state and audit', () => {
    const service = read('src/modules/service-bulletins/service-bulletin-sync.service.ts');
    expect(service).toMatch(/syncAll\(\s*evidence: PlatformMutationEvidence/); expect(service).toContain("requirePlatformMutationOperations(evidence, ['SERVICE_BULLETIN_SYNC'])");
    expect(service).toContain("pg_try_advisory_xact_lock(hashtext('JUPITER_SERVICE_BULLETIN_SYNC'))"); expect(service).toContain('executeAuthoritativePlatformMutation');
    expect(service).toMatch(/ServiceBulletinSyncRun\.create[\s\S]*\{ transaction \}/); expect(service).toMatch(/audit\.setBefore[\s\S]*afterBulletins[\s\S]*auditAfter/);
  });
  it('resolves the exact SERVICE principal fresh per scheduled run', () => {
    const service = read('src/modules/service-bulletins/service-bulletin-sync.service.ts');
    expect(service).toContain("process.env.SB_SYNC_SERVICE_CODE !== 'SB_SYNC_SCHEDULER'");
    expect(service).toMatch(/runScheduled\([\s\S]*new PlatformAuthorityRepository\(pool\)[\s\S]*resolveService\('SB_SYNC_SCHEDULER'\)/);
    expect(service.match(/this\.runScheduled\(\)/g)).toHaveLength(2);
  });
  it('defines one atomic least-privilege scheduler provisioning operation', () => {
    const repository = read('src/modules/platform-authority/platform-authority.repository.ts');
    const method = repository.slice(repository.indexOf('provisionSbSyncScheduler'), repository.indexOf('async grant(', repository.indexOf('provisionSbSyncScheduler')));
    expect(method).toContain("'SB_SYNC_SCHEDULER'"); expect(method).toContain("'SERVICE_BULLETIN_SYNC_EXECUTE'"); expect(method).toContain("'SERVICE'");
  });
  it('issues SERVICE evidence only for SERVICE-approved policy', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'service-id', principal_type: 'SERVICE', principal_code: 'SB_SYNC_SCHEDULER', capabilities: ['SERVICE_BULLETIN_SYNC_EXECUTE'] }] });
    const authority = await new PlatformAuthorityRepository({ query } as any).resolveService('SB_SYNC_SCHEDULER');
    const input = { reason: 'test', correlationId: randomUUID(), source: { kind: 'TEST' }, resourceType: 'service_bulletin_sync_run' };
    expect(() => platformServiceMutationEvidence(authority, ['SERVICE_BULLETIN_SYNC'], input)).not.toThrow();
    expect(() => platformServiceMutationEvidence(authority, ['MANUFACTURER_UPDATE'], input)).toThrow('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
  });
  it('does not persist ephemeral source paths in synchronized state', () => {
    const service = read('src/modules/service-bulletins/service-bulletin-sync.service.ts');
    expect(service).toContain("key !== 'file' && key !== 'pdf_path'"); expect(service).toContain("bulletin.source === 'PIPER_PDF' ? null");
  });
  it('allows scheduled sources only beneath the explicit trusted root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jupiter-sb-schedule-'));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'jupiter-sb-outside-'));
    try {
      const source = path.join(root, 'source.csv'); await fs.writeFile(source, 'number,title\nSB-1,Inspection\n');
      process.env.SB_SYNC_VERYON_TRUSTED_ROOT = root; process.env.SB_SYNC_VERYON_SOURCE = source;
      await expect(scheduledSbSyncFiles('VERYON')).resolves.toMatchObject({ veryonCsvPath: source, piperPdfPath: null });
      process.env.SB_SYNC_VERYON_SOURCE = path.join(outside, 'outside.csv'); await fs.writeFile(process.env.SB_SYNC_VERYON_SOURCE, 'x,y\n1,2\n');
      await expect(scheduledSbSyncFiles('VERYON')).rejects.toThrow('SB_SYNC_SCHEDULED_SOURCE_OUTSIDE_ROOT');
    } finally {
      delete process.env.SB_SYNC_VERYON_TRUSTED_ROOT; delete process.env.SB_SYNC_VERYON_SOURCE;
      await fs.rm(root, { recursive: true, force: true }); await fs.rm(outside, { recursive: true, force: true });
    }
  });
});
