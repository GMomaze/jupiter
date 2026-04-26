import fs from 'fs';
import path from 'path';
import { PdfService } from '../src/modules/workpacks/pdf.service.js';

const workpackId = process.argv[2];
console.log (`Generating CRS PDF for workpack ID: ${workpackId}...`);
if (!workpackId) {
  console.error('Usage: npx tsx scripts/test-crs-pdf.ts <workpackId>');
  process.exit(1);
}

const outputDir = path.resolve(process.cwd(), 'tmp');
const outputPath = path.join(outputDir, `crs-${workpackId}.pdf`);

fs.mkdirSync(outputDir, { recursive: true });

try {
  const buffer = await PdfService.generateCRS(workpackId);
  fs.writeFileSync(outputPath, buffer);
  console.log(`CRS PDF created: ${outputPath}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}