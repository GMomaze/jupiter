import PdfService1 from './src/modules/workpacks/pdf.service';
import PdfService from './src/modules/workpacks/pdf.crma';
async function main() {
  const pdf = new PdfService();

  // call whatever method exists inside
  await pdf.generateWorkpackPdf('TEST_ID'); // adjust method + params
}

main().catch(console.error);