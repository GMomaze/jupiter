import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

export class SnapshotService {
  static async generateCRS(taskId: string, htmlContent: string) {
    const browser = await puppeteer.launch({ 
      // Manually point to your system's Chrome executable
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true 
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const dir = path.join(process.cwd(), 'storage/snapshots');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const fileName = `CRS-${taskId}-${Date.now()}.pdf`;
      const filePath = path.join(dir, fileName);

      await page.pdf({ path: filePath, format: 'A4' });

      return `/storage/snapshots/${fileName}`;
    } finally {
      // Ensure the browser closes even if PDF generation fails
      await browser.close();
    }
  }
}