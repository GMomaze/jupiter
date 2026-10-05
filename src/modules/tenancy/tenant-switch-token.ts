import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ActiveTenantSessionContext } from './active-tenant-context.types.js';
import type {
  ExpectedTenantContextToken,
  OpaqueTenantSwitchCorrelationHash,
  RejectedTargetFingerprint,
  SafeRejectedTargetMetadata,
  TenantSwitchRejectionReason,
} from './tenant-switch-contracts.js';

const TOKEN_PREFIX = 'v1.';
const DIGEST_LENGTH = 32;
const MINIMUM_SECRET_BYTES = 32;
export const MAX_RECORDED_REJECTED_TARGET_LENGTH = 256;

type Secret = string | Uint8Array;
type ConstantTimeComparator = (left: Uint8Array, right: Uint8Array) => boolean;

export interface ExpectedContextTokenInput {
  readonly authenticatedUserId: string;
  readonly context: ActiveTenantSessionContext;
}

export interface TenantSwitchTokenCodec {
  createExpectedContextToken(input: ExpectedContextTokenInput): ExpectedTenantContextToken;
  verifyExpectedContextToken(
    token: unknown,
    input: ExpectedContextTokenInput,
  ): boolean;
  createRejectedTargetMetadata(
    tenantPublicId: string,
    reason: TenantSwitchRejectionReason,
  ): SafeRejectedTargetMetadata;
  createCorrelationHash(
    kind: 'REQUEST' | 'SESSION',
    opaqueSourceValue: string,
  ): OpaqueTenantSwitchCorrelationHash;
}

function secretBytes(secret: Secret): Uint8Array {
  const bytes = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : secret;
  if (bytes.byteLength < MINIMUM_SECRET_BYTES) {
    throw new Error('Tenant switch token secret is invalid.');
  }
  return bytes;
}

function encodeParts(parts: readonly (string | number)[]): string {
  return parts
    .map((part) => {
      const value = String(part);
      return `${Buffer.byteLength(value, 'utf8')}:${value}`;
    })
    .join('|');
}

function digest(secret: Uint8Array, domain: string, parts: readonly (string | number)[]): Buffer {
  return createHmac('sha256', secret)
    .update(domain, 'utf8')
    .update('\0', 'utf8')
    .update(encodeParts(parts), 'utf8')
    .digest();
}

function expectedContextDigest(
  secret: Uint8Array,
  input: ExpectedContextTokenInput,
): Buffer {
  const { context } = input;
  return digest(secret, 'jupiter:tenant-switch:expected-context:v1', [
    input.authenticatedUserId,
    context.tenantId,
    context.membershipId,
    context.contextVersion,
    context.selectedAt,
    context.validatedAt,
  ]);
}

function decodeToken(token: unknown): { readonly valid: boolean; readonly digest: Buffer } {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) {
    return { valid: false, digest: Buffer.alloc(DIGEST_LENGTH) };
  }

  const encoded = token.slice(TOKEN_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) {
    return { valid: false, digest: Buffer.alloc(DIGEST_LENGTH) };
  }

  const decoded = Buffer.from(encoded, 'base64url');
  const valid =
    decoded.byteLength === DIGEST_LENGTH && decoded.toString('base64url') === encoded;
  return {
    valid,
    digest: valid ? decoded : Buffer.alloc(DIGEST_LENGTH),
  };
}

export function createTenantSwitchTokenCodec(
  injectedSecret: Secret,
  compare: ConstantTimeComparator = timingSafeEqual,
): TenantSwitchTokenCodec {
  const secret = secretBytes(injectedSecret);

  const codec: TenantSwitchTokenCodec = {
    createExpectedContextToken(input: ExpectedContextTokenInput) {
      const encoded = expectedContextDigest(secret, input).toString('base64url');
      return `${TOKEN_PREFIX}${encoded}` as ExpectedTenantContextToken;
    },

    verifyExpectedContextToken(token: unknown, input: ExpectedContextTokenInput) {
      const expected = expectedContextDigest(secret, input);
      const candidate = decodeToken(token);
      const matches = compare(candidate.digest, expected);
      return candidate.valid && matches;
    },

    createRejectedTargetMetadata(
      tenantPublicId: string,
      reason: TenantSwitchRejectionReason,
    ) {
      const actualLength = Array.from(tenantPublicId).length;
      const fingerprint = digest(
        secret,
        'jupiter:tenant-switch:rejected-target:v1',
        [tenantPublicId],
      ).toString('base64url') as RejectedTargetFingerprint;

      return Object.freeze({
        fingerprint,
        boundedInputLength: Math.min(
          actualLength,
          MAX_RECORDED_REJECTED_TARGET_LENGTH,
        ),
        inputLengthCapped: actualLength > MAX_RECORDED_REJECTED_TARGET_LENGTH,
        reason,
      });
    },

    createCorrelationHash(
      kind: 'REQUEST' | 'SESSION',
      opaqueSourceValue: string,
    ) {
      return digest(
        secret,
        `jupiter:tenant-switch:correlation:${kind.toLowerCase()}:v1`,
        [opaqueSourceValue],
      ).toString('base64url') as OpaqueTenantSwitchCorrelationHash;
    },
  };

  return Object.freeze(codec);
}
