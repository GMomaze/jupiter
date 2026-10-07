'use strict';

// Copies the repository-owned EJS view templates from src/views into dist/views
// so that the compiled production entrypoint (`node dist/server.js`) can resolve
// them through `app.set('views', path.join(__dirname, 'views'))`.
//
// `tsc` compiles TypeScript but does not copy non-TypeScript assets, so without
// this step dist/views is empty and every `res.render(...)` fails with 500.
//
// The destination is cleared before each copy so that views deleted or renamed
// in source cannot linger as stale files inside a rebuilt artifact.

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = __dirname;
const sourceDir = path.join(repoRoot, 'src', 'views');
const outputDir = path.join(repoRoot, 'dist', 'views');

if (!fs.existsSync(sourceDir)) {
  throw new Error(`COPY_VIEWS: source directory not found: ${sourceDir}`);
}

// Remove any stale output first so deleted/renamed views cannot survive a rebuild.
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

fs.cpSync(sourceDir, outputDir, {
  recursive: true,
  filter(source) {
    // Copy directories and EJS view templates only. Never copy test files
    // (*.test.ts) or any other non-view source material into the artifact.
    return fs.statSync(source).isDirectory() || source.endsWith('.ejs');
  },
});

console.log(`COPY_VIEWS: copied EJS views from ${sourceDir} to ${outputDir}`);
