'use strict';

// Clears the repository build output directory (dist/) before TypeScript
// compilation so that stale compiled JavaScript — from source files that were
// deleted or renamed — cannot survive a rebuild. dist/ is gitignored build
// output only; nothing here touches source or runtime data.

const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(__dirname, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });

console.log(`CLEAN_DIST: removed ${distDir}`);
