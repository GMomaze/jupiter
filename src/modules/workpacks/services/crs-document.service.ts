import { DocumentPdfService } from './document-pdf.service.js';

export class CrsDocumentService {
  static async generate(data: Parameters<typeof DocumentPdfService.renderCrs>[0]) {
    return DocumentPdfService.renderCrs(data);
  }
}
