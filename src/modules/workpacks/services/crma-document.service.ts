import { DocumentPdfService } from './document-pdf.service.js';

export class CrmaDocumentService {
  static async generate(data: Parameters<typeof DocumentPdfService.renderCrma>[0]) {
    return DocumentPdfService.renderCrma(data);
  }
}
