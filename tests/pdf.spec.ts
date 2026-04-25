import { test } from '@playwright/test';
import PdfService from '../src/modules/workpacks/pdf.service';

test('generate pdf manually', async () => {
  const pdf = new PdfService();

  await pdf.generateWorkpackPdf('TEST_ID');
});