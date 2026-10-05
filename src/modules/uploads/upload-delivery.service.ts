import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type { UploadDeliveryRepository } from './upload-delivery.repository.js';
import { uploadDeliveryRepository } from './upload-delivery.repository.live.js';

export interface UploadDeliveryFileSystem {
  realpath(value: string): Promise<string>;
  lstat(value: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean }>;
}

export interface AuthorizedUploadFile {
  readonly absolutePath: string;
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(moduleDirectory, '..', '..', '..', 'uploads');

export const AIRCRAFT_UPLOAD_ROOT = process.env.AIRCRAFT_UPLOAD_ROOT ?? path.join(uploadsRoot, 'aircraft');
export const MANUFACTURER_UPLOAD_ROOT = process.env.MANUFACTURER_UPLOAD_ROOT ?? path.join(uploadsRoot, 'manufacturers');

const BASENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

export function canonicalUploadReference(
  kind: 'aircraft' | 'manufacturers',
  filename: unknown,
): string | undefined {
  if (typeof filename !== 'string' || filename.length === 0 || filename.length > 255) return undefined;
  if (
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..') ||
    filename.includes('%') ||
    /[\x00-\x1f\x7f]/.test(filename) ||
    /^[A-Za-z]:/.test(filename) ||
    path.posix.isAbsolute(filename) ||
    path.win32.isAbsolute(filename) ||
    !BASENAME_PATTERN.test(filename)
  ) return undefined;
  return `/uploads/${kind}/${filename}`;
}

function contained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

export class UploadDeliveryService {
  constructor(
    private readonly repository: UploadDeliveryRepository,
    private readonly fileSystem: UploadDeliveryFileSystem,
    private readonly roots: Readonly<{ aircraft: string; manufacturers: string }>,
  ) {}

  async aircraftPhoto(
    authority: TenantQueryAuthority,
    filename: unknown,
  ): Promise<AuthorizedUploadFile | undefined> {
    const reference = canonicalUploadReference('aircraft', filename);
    if (!reference) return undefined;
    if (!(await this.repository.authorizeAircraftPhoto(authority, reference))) return undefined;
    return this.safeFile(this.roots.aircraft, filename as string);
  }

  async manufacturerLogo(filename: unknown): Promise<AuthorizedUploadFile | undefined> {
    const reference = canonicalUploadReference('manufacturers', filename);
    if (!reference) return undefined;
    if (!(await this.repository.manufacturerLogoReferenceExists(reference))) return undefined;
    return this.safeFile(this.roots.manufacturers, filename as string);
  }

  private async safeFile(root: string, filename: string): Promise<AuthorizedUploadFile | undefined> {
    const lexicalTarget = path.resolve(root, filename);
    if (!contained(path.resolve(root), lexicalTarget)) return undefined;
    try {
      const [realRoot, metadata] = await Promise.all([
        this.fileSystem.realpath(root),
        this.fileSystem.lstat(lexicalTarget),
      ]);
      if (metadata.isSymbolicLink() || !metadata.isFile()) return undefined;
      const realTarget = await this.fileSystem.realpath(lexicalTarget);
      if (!contained(realRoot, realTarget)) return undefined;
      return Object.freeze({ absolutePath: realTarget });
    } catch {
      return undefined;
    }
  }
}

export const uploadDeliveryService = new UploadDeliveryService(
  uploadDeliveryRepository,
  fs,
  Object.freeze({ aircraft: AIRCRAFT_UPLOAD_ROOT, manufacturers: MANUFACTURER_UPLOAD_ROOT }),
);
