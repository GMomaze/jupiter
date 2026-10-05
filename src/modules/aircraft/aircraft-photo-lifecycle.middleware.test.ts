import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createAircraftPhotoLifecycle } from './aircraft-photo-lifecycle.middleware.js';

const root = path.resolve('uploads/aircraft');
const filename = '550e8400-e29b-41d4-a716-446655440000-aircraft.png';

class FakeFileSystem {
  files = new Set<string>();
  symlinks = new Set<string>();
  directories = new Set<string>();
  failures = new Set<string>();
  unlinks: string[] = [];

  async lstat(value: string) {
    if (!this.files.has(value) && !this.symlinks.has(value) && !this.directories.has(value)) {
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    }
    return {
      isFile: () => this.files.has(value),
      isSymbolicLink: () => this.symlinks.has(value),
    };
  }

  async realpath(value: string) {
    return path.resolve(value);
  }

  async unlink(value: string) {
    if (this.failures.has(value)) throw Object.assign(new Error('unlink failed'), { code: 'EACCES' });
    if (!this.files.delete(value)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    this.unlinks.push(value);
  }
}

function harness(overrides?: { filename?: string; path?: string; destination?: string }) {
  const fileSystem = new FakeFileSystem();
  const errors: unknown[] = [];
  const lifecycle = createAircraftPhotoLifecycle({
    fileSystem,
    uploadRoot: root,
    reportCleanupError: error => errors.push(error),
  });
  const req: any = {};
  const res: any = new EventEmitter();
  const next = vi.fn();
  lifecycle.begin(req, res, next);
  req.file = {
    filename: overrides?.filename ?? filename,
    destination: overrides?.destination ?? root,
    path: overrides?.path ?? path.join(root, overrides?.filename ?? filename),
  };
  return { lifecycle, fileSystem, errors, req, res, next };
}

async function trackedHarness() {
  const value = harness();
  value.fileSystem.files.add(path.join(root, filename));
  value.lifecycle.track(value.req, value.res, value.next);
  return value;
}

async function flush() {
  await vi.waitFor(() => undefined);
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('Aircraft photo persistence lifecycle', () => {
  it('starts a request before upload and tracks only server Multer metadata', async () => {
    const value = await trackedHarness();
    expect(value.next).toHaveBeenCalledTimes(2);
  });

  it.each(['CSRF', 'CREATE_VALIDATION', 'UPDATE_VALIDATION', 'FOREIGN', 'NOT_FOUND', 'STALE', 'SERVICE'])('%s failure cleans the uncommitted upload', async () => {
    const value = await trackedHarness();
    value.res.emit('finish');
    await flush();
    expect(value.fileSystem.unlinks).toEqual([path.join(root, filename)]);
  });

  it('successful create commit retains the upload on finish', async () => {
    const value = await trackedHarness();
    value.lifecycle.commit(value.req);
    value.res.emit('finish');
    await flush();
    expect(value.fileSystem.unlinks).toEqual([]);
  });

  it('successful update commit retains the upload on close', async () => {
    const value = await trackedHarness();
    value.lifecycle.commit(value.req);
    value.res.emit('close');
    await flush();
    expect(value.fileSystem.unlinks).toEqual([]);
  });

  it('an update without a file is a no-op', async () => {
    const value = harness();
    delete value.req.file;
    value.lifecycle.track(value.req, value.res, value.next);
    value.res.emit('finish');
    await flush();
    expect(value.fileSystem.unlinks).toEqual([]);
  });

  it('multiple completion signals clean at most once', async () => {
    const value = await trackedHarness();
    value.res.emit('finish');
    value.res.emit('close');
    value.lifecycle.cleanup(value.req);
    await flush();
    expect(value.fileSystem.unlinks).toHaveLength(1);
  });

  it('premature close waits for a running controller and cleans after failure', async () => {
    const value = await trackedHarness();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    value.lifecycle.wrap(async () => pending)(value.req, value.res, value.next);
    value.res.emit('close');
    await flush();
    expect(value.fileSystem.unlinks).toEqual([]);
    release();
    await flush();
    expect(value.fileSystem.unlinks).toHaveLength(1);
  });

  it('premature close cannot delete a file committed by an in-flight controller', async () => {
    const value = await trackedHarness();
    let release!: () => void;
    const handler = value.lifecycle.wrap(async req => {
      await new Promise<void>(resolve => { release = resolve; });
      value.lifecycle.commit(req);
    });
    handler(value.req, value.res, value.next);
    value.res.emit('close');
    release();
    await flush();
    expect(value.fileSystem.unlinks).toEqual([]);
  });

  it('rejects an arbitrary client-selected path', () => {
    const value = harness({ path: path.resolve('uploads/aircraft/other.png') });
    value.lifecycle.track(value.req, value.res, value.next);
    expect(value.next.mock.calls.at(-1)?.[0]).toBeInstanceOf(Error);
  });

  it('rejects traversal outside the upload root', () => {
    const value = harness({ filename: '../escape.png', path: path.resolve('uploads/escape.png') });
    value.lifecycle.track(value.req, value.res, value.next);
    expect(value.next.mock.calls.at(-1)?.[0]).toBeInstanceOf(Error);
  });

  it('rejects a mismatched upload destination', () => {
    const value = harness({ destination: path.resolve('uploads/manufacturers') });
    value.lifecycle.track(value.req, value.res, value.next);
    expect(value.next.mock.calls.at(-1)?.[0]).toBeInstanceOf(Error);
  });

  it('does not unlink a symlink', async () => {
    const value = await trackedHarness();
    value.fileSystem.files.clear();
    value.fileSystem.symlinks.add(path.join(root, filename));
    value.res.emit('finish');
    await flush();
    expect(value.fileSystem.unlinks).toEqual([]);
  });

  it('does not unlink a non-regular file', async () => {
    const value = await trackedHarness();
    value.fileSystem.files.clear();
    value.fileSystem.directories.add(path.join(root, filename));
    value.res.emit('finish');
    await flush();
    expect(value.fileSystem.unlinks).toEqual([]);
  });

  it('treats a missing target as idempotent cleanup success', async () => {
    const value = await trackedHarness();
    value.fileSystem.files.clear();
    value.res.emit('finish');
    await flush();
    expect(value.errors).toEqual([]);
  });

  it('reports unexpected cleanup failure without alternative deletion', async () => {
    const value = await trackedHarness();
    value.fileSystem.failures.add(path.join(root, filename));
    value.res.emit('finish');
    await flush();
    expect(value.errors).toHaveLength(1);
    expect(value.fileSystem.unlinks).toEqual([]);
  });

  it('uses collision-resistant Aircraft names without changing other upload naming', () => {
    const source = fs.readFileSync(path.resolve('src/middleware/upload.middleware.ts'), 'utf8');
    const manufacturer = source.slice(source.indexOf('const manufacturerLogoStorage'), source.indexOf('function imageFileFilter'));
    const aircraft = source.slice(source.indexOf('const aircraftPhotoStorage'), source.indexOf('export const aircraftPhotoUpload'));
    expect(manufacturer).toContain('`${Date.now()}-${basename}${extension}`');
    expect(manufacturer).not.toContain('randomUUID()');
    expect(aircraft).toContain('`${randomUUID()}-${basename}${extension}`');
  });

  it('places tenant authority before lifecycle/upload and CSRF after tracking', () => {
    const routes = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft.routes.ts'), 'utf8');
    for (const marker of ["router.post('/',", "router.post('/:id',", "router.patch('/:id',"]) {
      const line = routes.slice(routes.indexOf(marker), routes.indexOf('\n', routes.indexOf(marker)));
      expect(line.indexOf('requireAircraftTenant')).toBeLessThan(line.indexOf('aircraftPhotoLifecycle.begin'));
      expect(line.indexOf('aircraftPhotoLifecycle.track')).toBeLessThan(line.indexOf('csrfProtection'));
    }
  });

  it('marks create and update committed only after their service calls', () => {
    const controller = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft.controller.ts'), 'utf8');
    for (const serviceCall of ['AircraftService.create(', 'AircraftService.updateDetails(']) {
      const start = controller.indexOf(serviceCall);
      const commit = controller.indexOf('aircraftPhotoLifecycle.commit(req)', start);
      expect(commit).toBeGreaterThan(start);
    }
  });

  it('contains no old-photo or shared-reference deletion path', () => {
    const controller = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft.controller.ts'), 'utf8');
    const lifecycle = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft-photo-lifecycle.middleware.ts'), 'utf8');
    expect(controller).not.toMatch(/unlink|rmSync|delete.*photo/i);
    expect(lifecycle).not.toMatch(/photo_url|Aircraft\.|findAll|findOne/);
  });
});
