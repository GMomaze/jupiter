import { PdfService } from '../src/modules/workpacks/pdf.service';
import fs from 'fs';

async function main() {
  const workpackId = '944ece82-6f9c-4367-947f-1edda8f220f6';

  const buffer = await PdfService.generateCRS(workpackId);

  fs.writeFileSync('output1.pdf', buffer);

  console.log('PDF generated: output1.pdf');
}

main().catch(console.error);