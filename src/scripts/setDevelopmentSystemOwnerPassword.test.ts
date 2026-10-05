import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(relative, 'utf8');

describe('System Owner password workflow', () => {
  it('retries password/confirmation mismatch up to three attempts then fails closed', () => {
    const source = read('src/scripts/setDevelopmentSystemOwnerPassword.ts');
    expect(source).toContain('MAX_ATTEMPTS = 3');
    expect(source).toContain('attempt < MAX_ATTEMPTS');
    expect(source).toContain('continue');
    expect(source).toContain("throw new Error('SET_SYSTEM_OWNER_PASSWORD_MISMATCH')");
    // masked, non-echoing entry is preserved
    expect(source).toContain('setRawMode');
    expect(source).toContain("process.stdout.write('*')");
    // never echoes/logs the plaintext
    expect(source).not.toMatch(/console\.log\(\s*(password|confirm)\s*\)/);
    expect(source).toContain('hashPassword(password)');
  });

  it('preserves development-only and authorization guards', () => {
    const source = read('src/scripts/setDevelopmentSystemOwnerPassword.ts');
    expect(source).toContain("process.env.NODE_ENV !== 'development'");
    expect(source).toContain('SET_SYSTEM_OWNER_PASSWORD_REQUIRES_DEVELOPMENT');
    expect(source).toContain("process.env.ALLOW_SET_SYSTEM_OWNER_PASSWORD !== 'YES'");
    expect(source).toContain('SET_SYSTEM_OWNER_PASSWORD_NOT_AUTHORIZED');
    expect(source).toContain("!== 'jupiter_db'");
    expect(source).toContain('SET_SYSTEM_OWNER_PASSWORD_DB_MISMATCH');
  });

  it('provides a standalone npm command that establishes the guarded development authorization', () => {
    const pkg = read('package.json');
    expect(pkg).toContain('"platform:owner:password"');
    expect(pkg).toContain('cross-env NODE_ENV=development ALLOW_SET_SYSTEM_OWNER_PASSWORD=YES PLATFORM_OWNER_EMAIL=systemowner@jupiter.local');
    expect(pkg).toContain('src/scripts/setDevelopmentSystemOwnerPassword.ts');
  });
});
