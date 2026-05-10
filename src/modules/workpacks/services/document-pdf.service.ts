import PDFDocument from 'pdfkit';

type CrsData = Awaited<ReturnType<typeof import('./crs-data.service.js').CrsDataService.getCrsDataForWorkpack>>;
type CrmaData = Awaited<ReturnType<typeof import('./crma-data.service.js').CrmaDataService.getCrmaDataForWorkpack>>;

export class DocumentPdfService {
  private static readonly palette = {
    ink: '#0f172a',
    muted: '#475569',
    line: '#cbd5e1',
    panel: '#f8fafc',
    accent: '#17365d',
  };

  private static formatDate(value: Date | null | undefined) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(value);
  }

  private static formatDateTime(value: Date | null | undefined) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  }

  private static drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('WHIP-AIR Aviation', 40, 36);

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(10)
      .text('AMO 1386', 40, 58);

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(title, 40, 88);

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(9)
      .text(subtitle, 40, 108, { width: 515 });

    doc
      .moveTo(40, 136)
      .lineTo(555, 136)
      .strokeColor(this.palette.line)
      .lineWidth(1)
      .stroke();
  }

  private static drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number) {
    doc
      .fillColor(this.palette.panel)
      .rect(40, y, 515, 18)
      .fill();

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(title.toUpperCase(), 48, y + 4);
  }

  private static drawFieldGrid(
    doc: PDFKit.PDFDocument,
    y: number,
    fields: Array<{ label: string; value: string }>
  ) {
    const colWidth = 247;
    let currentY = y;

    for (let index = 0; index < fields.length; index += 2) {
      const row = fields.slice(index, index + 2);
      let x = 40;

      for (const field of row) {
        doc
          .fillColor(this.palette.muted)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(field.label, x, currentY, { width: colWidth });

        doc
          .fillColor(this.palette.ink)
          .font('Helvetica')
          .fontSize(10)
          .text(field.value || '-', x, currentY + 11, { width: colWidth });

        x += colWidth + 21;
      }

      currentY += 34;
    }

    return currentY;
  }

  private static drawWrappedParagraph(
    doc: PDFKit.PDFDocument,
    text: string,
    y: number
  ) {
    doc
      .fillColor(this.palette.ink)
      .font('Helvetica')
      .fontSize(9)
      .text(text, 40, y, { width: 515, lineGap: 2 });

    return doc.y;
  }

  private static drawTaskTable(
    doc: PDFKit.PDFDocument,
    y: number,
    rows: Array<{ card: string; title: string; detail: string; certification?: string }>
  ) {
    const columns = [85, 160, 190, 80];
    const headers = ['Task', 'Title', 'Work Performed', 'Certified'];
    let x = 40;

    doc.font('Helvetica-Bold').fontSize(8).fillColor(this.palette.accent);
    headers.forEach((header, index) => {
      doc
        .rect(x, y, columns[index] || 0, 20)
        .strokeColor(this.palette.line)
        .lineWidth(1)
        .stroke();
      doc.text(header, x + 6, y + 6, { width: (columns[index] || 0) - 12 });
      x += columns[index] || 0;
    });

    let currentY = y + 20;
    for (const row of rows) {
      const values = [row.card, row.title, row.detail, row.certification || '-'];
      const heights = values.map((value, index) =>
        doc.heightOfString(value || '-', {
          width: (columns[index] || 0) - 12,
        })
      );
      const rowHeight = Math.max(26, ...heights.map((height) => height + 12));

      let currentX = 40;
      values.forEach((value, index) => {
        doc
          .rect(currentX, currentY, columns[index] || 0, rowHeight)
          .strokeColor(this.palette.line)
          .lineWidth(1)
          .stroke();
        doc
          .fillColor(this.palette.ink)
          .font('Helvetica')
          .fontSize(8)
          .text(value || '-', currentX + 6, currentY + 6, {
            width: (columns[index] || 0) - 12,
          });
        currentX += columns[index] || 0;
      });

      currentY += rowHeight;
    }

    return currentY;
  }

  private static drawComplianceSummary(
    doc: PDFKit.PDFDocument,
    y: number,
    compliance: CrsData['compliance']
  ) {
    const sections = [
      { label: 'AD', items: compliance?.ad_items || [] },
      { label: 'SB', items: compliance?.sb_items || [] },
      { label: 'SID', items: (compliance as any)?.sid_items || [] },
    ];

    let currentY = y;

    for (const section of sections) {
      doc
        .fillColor(this.palette.accent)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`${section.label} Completed`, 40, currentY);
      currentY += 14;

      if (section.items.length === 0) {
        doc
          .fillColor(this.palette.muted)
          .font('Helvetica')
          .fontSize(8)
          .text('No completed items recorded.', 48, currentY);
        currentY += 16;
        continue;
      }

      for (const item of section.items) {
        doc
          .fillColor(this.palette.ink)
          .font('Helvetica')
          .fontSize(8)
          .text(`${item.code} - ${item.title}`, 48, currentY, { width: 500 });
        currentY = doc.y + 4;
      }
    }

    return currentY;
  }

  private static toBuffer(
    draw: (doc: PDFKit.PDFDocument) => void
  ): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw(doc);
      doc.end();
    });
  }

  static async renderCrs(data: CrsData) {
    return this.toBuffer((doc) => {
      this.drawHeader(
        doc,
        'Certificate of Release to Service',
        'Generated from stored certified workpack data. This document is a snapshot of system state at generation time.'
      );

      let y = 154;
      this.drawSectionTitle(doc, 'Workpack Identity', y);
      y = this.drawFieldGrid(doc, y + 28, [
        { label: 'Aircraft Registration', value: data.aircraft.registration || '-' },
        { label: 'Aircraft Model', value: data.aircraft.model || '-' },
        { label: 'Serial Number', value: data.aircraft.serial_number || '-' },
        { label: 'Workpack Reference', value: data.workpack.work_order_number || '-' },
        { label: 'Opened At', value: this.formatDate(data.workpack.opened_at) },
        { label: 'Certified At', value: this.formatDateTime(data.workpack.certified_at) },
      ]);

      this.drawSectionTitle(doc, 'Work Performed Summary', y + 6);
      y = this.drawTaskTable(
        doc,
        y + 30,
        data.work_summary.map((item) => ({
          card: item.task_card_number || item.task_id,
          title: item.title || '-',
          detail: item.work_performed || '-',
          certification: this.formatDateTime(item.certified_at),
        }))
      );

      this.drawSectionTitle(doc, 'Compliance Summary', y + 10);
      y = this.drawComplianceSummary(doc, y + 34, data.compliance);

      this.drawSectionTitle(doc, 'Certification', y + 10);
      this.drawFieldGrid(doc, y + 38, [
        { label: 'Certifying Engineer', value: data.certification.engineer_name || '-' },
        { label: 'Certification Reference', value: data.certification.licence_number || '-' },
        { label: 'Certified At', value: this.formatDateTime(data.certification.certified_at) },
        { label: 'Organisation', value: `${data.certification.organisation.name} (${data.certification.organisation.amo_number})` },
      ]);
    });
  }

  static async renderCrma(data: CrmaData) {
    return this.toBuffer((doc) => {
      this.drawHeader(
        doc,
        'Certificate of Release to Maintenance Action',
        'This document applies only to the listed maintenance action scope. It does not imply full workpack release to service.'
      );

      let y = 154;
      this.drawSectionTitle(doc, 'Maintenance Action Scope', y);
      y = this.drawFieldGrid(doc, y + 28, [
        { label: 'Aircraft Registration', value: data.aircraft.registration || '-' },
        { label: 'Aircraft Model', value: data.aircraft.model || '-' },
        { label: 'Serial Number', value: data.aircraft.serial_number || '-' },
        { label: 'Workpack Reference', value: data.workpack.work_order_number || '-' },
        { label: 'Tasks In Scope', value: String(data.tasks.length) },
        { label: 'Latest Certification', value: this.formatDateTime(data.certification.latest_certified_at) },
      ]);

      this.drawSectionTitle(doc, 'Released Task Scope', y + 6);
      y = this.drawTaskTable(
        doc,
        y + 30,
        data.tasks.map((item) => ({
          card: item.task_card_number || item.task_id,
          title: item.title || '-',
          detail: item.work_performed || '-',
          certification: `${item.engineer_name || '-'}\n${this.formatDateTime(item.certified_at)}`,
        }))
      );

      this.drawSectionTitle(doc, 'Certification Statement', y + 10);
      y = this.drawWrappedParagraph(
        doc,
        'The maintenance action scope listed above has recorded engineer certification in the stored workpack data. This CRMA is limited to that scope only and must not be interpreted as a full Certificate of Release to Service for the entire workpack.',
        y + 34
      );

      this.drawSectionTitle(doc, 'Certifying Engineers', y + 14);
      this.drawWrappedParagraph(
        doc,
        data.certification.engineer_names.join(', ') || 'No engineer names recorded.',
        y + 38
      );
    });
  }
}
