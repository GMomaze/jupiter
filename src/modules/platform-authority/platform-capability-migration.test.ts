import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLATFORM_MUTATION_CAPABILITIES } from './platform-authority.js';

const source = fs.readFileSync('migrations/599_seed_fail_closed_platform_capabilities.ts', 'utf8');

describe('migration 599 capability seed contract', () => {
  it('seeds every exact capability once as active and system locked', () => {
    for (const capability of PLATFORM_MUTATION_CAPABILITIES) expect(source.match(new RegExp(`^  \\['${capability}'`, 'gm'))).toHaveLength(1);
    expect(PLATFORM_MUTATION_CAPABILITIES).toHaveLength(15);
    expect(source).toContain('true,true');
  });
  it('requires 598, refuses collisions, and creates no grants', () => {
    expect(source).toContain('MIGRATION_599_REQUIRES_VERIFIED_598_FOUNDATION');
    expect(source).toContain('MIGRATION_599_REFUSES_EXISTING_CAPABILITY');
    expect(source).not.toMatch(/INSERT INTO platform_capability_grants/);
  });
  it('protects grants and audit evidence on DOWN without removing L2-1 capabilities', () => {
    expect(source).toContain('MIGRATION_599_DOWN_REFUSES_AUTHORITY_EVIDENCE');
    expect(source).not.toMatch(/DELETE FROM platform_capabilities WHERE code IN\s*\(['"]PLATFORM_AUTHORITY_MANAGE/);
  });
});
