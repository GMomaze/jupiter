import fs from 'node:fs/promises';
import path from 'node:path';
import type { Request, RequestHandler } from 'express';
import {
  AIRCRAFT_UPLOAD_ROOT,
  canonicalUploadReference,
} from '../uploads/upload-delivery.service.js';

interface AircraftPhotoFileSystem {
  lstat(value: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
  realpath(value: string): Promise<string>;
  unlink(value: string): Promise<void>;
}

interface TrackedPhoto {
  readonly absolutePath: string;
  readonly filename: string;
  readonly reference: string;
}

interface LifecycleState {
  tracked?: TrackedPhoto;
  committed: boolean;
  controllerRunning: boolean;
  cleanupRequested: boolean;
  cleanupStarted: boolean;
  cleanupPromise?: Promise<void>;
}

type UploadedRequest = Request & { file?: Express.Multer.File };

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function createAircraftPhotoLifecycle(options: {
  fileSystem: AircraftPhotoFileSystem;
  uploadRoot: string;
  reportCleanupError?: (error: unknown) => void;
}) {
  const states = new WeakMap<Request, LifecycleState>();
  const uploadRoot = path.resolve(options.uploadRoot);
  const reportCleanupError = options.reportCleanupError ?? ((error) => {
    console.error('[AircraftPhotoLifecycle] Unable to clean uncommitted upload:', error);
  });

  async function safeCleanup(state: LifecycleState): Promise<void> {
    if (state.cleanupStarted || state.committed || !state.tracked) return state.cleanupPromise;
    state.cleanupStarted = true;
    state.cleanupPromise = (async () => {
      const tracked = state.tracked!;
      const canonicalReference = canonicalUploadReference('aircraft', tracked.filename);
      const expectedPath = path.resolve(uploadRoot, tracked.filename);
      if (
        !canonicalReference ||
        canonicalReference !== tracked.reference ||
        path.basename(tracked.filename) !== tracked.filename ||
        expectedPath !== tracked.absolutePath ||
        !isContained(uploadRoot, expectedPath)
      ) return;

      try {
        const metadata = await options.fileSystem.lstat(expectedPath);
        if (metadata.isSymbolicLink() || !metadata.isFile()) return;
        const [realRoot, realTarget] = await Promise.all([
          options.fileSystem.realpath(uploadRoot),
          options.fileSystem.realpath(expectedPath),
        ]);
        if (!isContained(realRoot, realTarget)) return;
        await options.fileSystem.unlink(expectedPath);
      } catch (error: any) {
        if (error?.code !== 'ENOENT') reportCleanupError(error);
      }
    })();
    return state.cleanupPromise;
  }

  function requestCleanup(req: Request): void {
    const state = states.get(req);
    if (!state || state.committed) return;
    state.cleanupRequested = true;
    if (!state.controllerRunning) void safeCleanup(state);
  }

  const begin: RequestHandler = (req, res, next) => {
    if (states.has(req)) return next(new Error('AIRCRAFT_PHOTO_LIFECYCLE_ALREADY_STARTED'));
    states.set(req, {
      committed: false,
      controllerRunning: false,
      cleanupRequested: false,
      cleanupStarted: false,
    });
    res.once('finish', () => requestCleanup(req));
    res.once('close', () => requestCleanup(req));
    next();
  };

  const track: RequestHandler = (req, _res, next) => {
    const state = states.get(req);
    if (!state) return next(new Error('AIRCRAFT_PHOTO_LIFECYCLE_REQUIRED'));
    const file = (req as UploadedRequest).file;
    if (!file) return next();

    const filename = file.filename;
    const reference = canonicalUploadReference('aircraft', filename);
    const expectedPath = path.resolve(uploadRoot, filename);
    if (
      !reference ||
      path.basename(filename) !== filename ||
      path.resolve(file.destination) !== uploadRoot ||
      path.resolve(file.path) !== expectedPath ||
      !isContained(uploadRoot, expectedPath)
    ) return next(new Error('AIRCRAFT_PHOTO_UPLOAD_TRACKING_INVALID'));

    state.tracked = Object.freeze({ absolutePath: expectedPath, filename, reference });
    next();
  };

  function commit(req: Request): void {
    const state = states.get(req);
    if (!state) throw new Error('AIRCRAFT_PHOTO_LIFECYCLE_REQUIRED');
    state.committed = true;
  }

  function wrap(handler: RequestHandler): RequestHandler {
    return (req, res, next) => {
      const state = states.get(req);
      if (!state) return next(new Error('AIRCRAFT_PHOTO_LIFECYCLE_REQUIRED'));
      state.controllerRunning = true;
      Promise.resolve(handler(req, res, next))
        .catch(next)
        .finally(() => {
          state.controllerRunning = false;
          if (state.cleanupRequested && !state.committed) void safeCleanup(state);
        });
    };
  }

  return Object.freeze({ begin, track, commit, wrap, cleanup: requestCleanup });
}

export const aircraftPhotoLifecycle = createAircraftPhotoLifecycle({
  fileSystem: fs,
  uploadRoot: AIRCRAFT_UPLOAD_ROOT,
});
