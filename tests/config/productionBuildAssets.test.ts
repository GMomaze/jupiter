import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('production build view-asset contract', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  const copyScript = readFileSync('copy-views.cjs', 'utf8');
  const cleanScript = readFileSync('clean-dist.cjs', 'utf8');

  it('wires a clean + copy build pipeline for reproducible artifacts', () => {
    expect(packageJson.scripts['build']).toContain('node clean-dist.cjs');
    expect(packageJson.scripts['build']).toContain('tsc');
    expect(packageJson.scripts['build']).toContain('node copy-views.cjs');
  });

  it('clears the build output directory so stale compiled JS cannot linger', () => {
    expect(cleanScript).toContain("path.join(__dirname, 'dist')");
    expect(cleanScript).toContain('fs.rmSync(distDir, { recursive: true, force: true })');
  });

  it('copies the complete src/views tree into dist/views', () => {
    expect(copyScript).toContain("path.join(repoRoot, 'src', 'views')");
    expect(copyScript).toContain("path.join(repoRoot, 'dist', 'views')");
    expect(copyScript).toContain('fs.cpSync(sourceDir, outputDir');
  });

  it('clears stale view output so deleted/renamed views cannot linger', () => {
    expect(copyScript).toContain('fs.rmSync(outputDir, { recursive: true, force: true })');
  });

  it('copies only EJS views and never test files', () => {
    expect(copyScript).toContain("source.endsWith('.ejs')");
    expect(copyScript).not.toContain("endsWith('.test.ts')");
  });
});
