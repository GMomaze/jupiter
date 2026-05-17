import PDFDocument from 'pdfkit';
import {
  PrintableWorkpackCoverPageSnapshot,
  PrintableWorkpackSnagSnapshot,
  PrintableWorkpackService,
  PrintableWorkpackTaskBodySnapshot,
  PrintableWorkpackTaskBodyTaskSnapshot,
  PrintableWorkpackTaskMeasurementSnapshot,
  PrintableWorkpackTaskSignatureSnapshot,
} from './printable-workpack.service.js';

type PrintablePageContext =
  | {
      kind: 'cover';
      workpack_reference: string;
      status_code: string | null;
      revision_number: number;
      generated_at: Date;
    }
  | {
      kind: 'task';
      workpack_reference: string;
      task_reference: string | null;
      task_title: string;
      continuation: boolean;
      aircraft_registration: string | null;
    }
  | {
      kind: 'snag';
      workpack_reference: string;
      snag_reference: string | null;
      continuation: boolean;
      aircraft_registration: string | null;
    };

type TaskRenderState = {
  y: number;
  continuationIndex: number;
};

type MeasurementDisplayRow = {
  field_label: string;
  reference_text: string | null;
  recorded_value: string | null;
};

type ToolControlDisplayRow = {
  field_label: string;
  authoritative_reference: string | null;
  recorded_value: string | null;
  handwritten_prompt: string;
};

export class PrintableWorkpackPdfService {
  private static readonly page = {
    size: 'A4' as const,
    width: 595.28,
    height: 841.89,
    marginX: 36,
    marginTop: 32,
    marginBottom: 32,
    contentWidth: 523.28,
  };

  private static readonly palette = {
    ink: '#0f172a',
    muted: '#475569',
    line: '#cbd5e1',
    panel: '#f8fafc',
    accent: '#17365d',
    strong: '#0b3a6e',
    continuation: '#e8f1f8',
  };

  private static readonly taskLayout = {
    contentTop: 136,
    contentBottom: 736,
    sectionGap: 14,
    boxPadding: 10,
  };

  private static formatDate(value: Date | null | undefined) {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(value);
  }

  private static formatDateTime(value: Date | null | undefined) {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(value);
  }

  private static formatNumber(value: number | null | undefined, digits = 0) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '-';
    }

    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }

  private static formatText(value: string | null | undefined) {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : '-';
  }

  private static joinLines(lines: string[] | null | undefined) {
    if (!Array.isArray(lines) || lines.length === 0) {
      return '-';
    }

    const normalized = lines
      .map((line) => String(line || '').trim())
      .filter(Boolean);

    return normalized.length > 0 ? normalized.join('\n') : '-';
  }

  private static normalizeParagraphs(value: string | null | undefined) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  private static toBuffer(
    draw: (doc: PDFKit.PDFDocument) => void
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      margin: 0,
      size: this.page.size,
      autoFirstPage: true,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw(doc);
      doc.end();
    });
  }

  private static drawPageFrame(doc: PDFKit.PDFDocument) {
    doc
      .save()
      .lineWidth(1)
      .strokeColor(this.palette.line)
      .rect(24, 24, this.page.width - 48, this.page.height - 48)
      .stroke()
      .restore();

    doc
      .save()
      .lineWidth(4)
      .strokeColor(this.palette.strong)
      .moveTo(24, 24)
      .lineTo(this.page.width - 24, 24)
      .stroke()
      .restore();
  }

  private static drawHeader(
    doc: PDFKit.PDFDocument,
    data: PrintableWorkpackCoverPageSnapshot
  ) {
    const x = this.page.marginX;

    doc
      .fillColor(this.palette.strong)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('PRINTABLE WORKPACK', x, 36, { width: 330 });

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('COVER PAGE', x, 62, { width: 160 });

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(data.workpack.work_order_number || '-', 360, 38, {
        width: 200,
        align: 'right',
      });

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(9)
      .text(
        'Generated from authoritative Jupiter snapshot data. This PDF is a downstream operational artifact only.',
        x,
        82,
        { width: this.page.contentWidth, lineGap: 2 }
      );

    doc
      .moveTo(x, 112)
      .lineTo(x + this.page.contentWidth, 112)
      .strokeColor(this.palette.line)
      .lineWidth(1)
      .stroke();
  }

  private static drawSectionTitle(
    doc: PDFKit.PDFDocument,
    title: string,
    x: number,
    y: number,
    width: number
  ) {
    doc.save();
    doc
      .fillColor(this.palette.panel)
      .rect(x, y, width, 18)
      .fill();

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(title.toUpperCase(), x + 8, y + 4, { width: width - 16 });
    doc.restore();
  }

  private static drawKeyValueGrid(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    fields: Array<{ label: string; value: string }>
  ) {
    const gap = 18;
    const colWidth = (width - gap) / 2;
    let currentY = y;

    for (let index = 0; index < fields.length; index += 2) {
      const row = fields.slice(index, index + 2);
      let rowHeight = 0;

      for (let rowIndex = 0; rowIndex < row.length; rowIndex += 1) {
        const field = row[rowIndex];
        if (!field) {
          continue;
        }

        const valueHeight = doc.heightOfString(field.value, {
          width: colWidth,
          align: 'left',
        });
        rowHeight = Math.max(rowHeight, 18 + valueHeight);
      }

      rowHeight = Math.max(rowHeight, 30);

      for (let rowIndex = 0; rowIndex < row.length; rowIndex += 1) {
        const field = row[rowIndex];
        if (!field) {
          continue;
        }

        const currentX = x + rowIndex * (colWidth + gap);

        doc
          .fillColor(this.palette.muted)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(field.label, currentX, currentY, { width: colWidth });

        doc
          .fillColor(this.palette.ink)
          .font('Helvetica')
          .fontSize(10)
          .text(field.value, currentX, currentY + 11, {
            width: colWidth,
            lineGap: 1,
          });
      }

      currentY += rowHeight + 8;
    }

    return currentY;
  }

  private static drawSummaryPanel(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    title: string,
    lines: Array<{ label: string; value: string }>
  ) {
    const bodyHeight = Math.max(72, lines.length * 16 + 18);

    doc
      .save()
      .fillColor('#ffffff')
      .strokeColor(this.palette.line)
      .lineWidth(1)
      .roundedRect(x, y, width, bodyHeight, 6)
      .fillAndStroke()
      .restore();

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(title.toUpperCase(), x + 10, y + 10, { width: width - 20 });

    let currentY = y + 28;
    for (const line of lines) {
      doc
        .fillColor(this.palette.muted)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(line.label, x + 10, currentY, { width: width * 0.55 });

      doc
        .fillColor(this.palette.ink)
        .font('Helvetica')
        .fontSize(8)
        .text(line.value, x + width * 0.58, currentY, {
          width: width * 0.32,
          align: 'right',
        });

      currentY += 14;
    }

    return y + bodyHeight;
  }

  private static drawAuthorityBand(
    doc: PDFKit.PDFDocument,
    data: PrintableWorkpackCoverPageSnapshot,
    y: number
  ) {
    const x = this.page.marginX;
    const width = this.page.contentWidth;

    doc
      .save()
      .fillColor('#eef5fb')
      .roundedRect(x, y, width, 34, 6)
      .fill()
      .restore();

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('AUTHORITY BOUNDARY', x + 10, y + 7, { width: 140 });

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Lifecycle: ${data.authority.lifecycle_authority}   Certification: ${data.authority.certification_authority}   Audit: ${data.authority.audit_authority}   Mutation: NOT PERMITTED`,
        x + 150,
        y + 8,
        { width: width - 160 }
      );

    return y + 48;
  }

  private static drawCoverPageContent(
    doc: PDFKit.PDFDocument,
    data: PrintableWorkpackCoverPageSnapshot
  ) {
    this.drawPageFrame(doc);
    this.drawHeader(doc, data);

    let y = 126;
    y = this.drawAuthorityBand(doc, data, y);

    this.drawSectionTitle(
      doc,
      'Workpack Metadata',
      this.page.marginX,
      y,
      this.page.contentWidth
    );
    y = this.drawKeyValueGrid(doc, this.page.marginX, y + 28, this.page.contentWidth, [
      { label: 'Workpack Reference', value: this.formatText(data.workpack.work_order_number) },
      { label: 'Current Status', value: this.formatText(data.workpack.status_code) },
      { label: 'Planning Session', value: this.formatText(data.workpack.planning_session_id) },
      { label: 'Snapshot Generated', value: this.formatDateTime(data.snapshot.generated_at) },
      { label: 'Workpack Created', value: this.formatDateTime(data.workpack.created_at) },
      { label: 'Last Updated', value: this.formatDateTime(data.workpack.updated_at) },
    ]);

    this.drawSectionTitle(
      doc,
      'Aircraft Information',
      this.page.marginX,
      y + 4,
      this.page.contentWidth
    );
    y = this.drawKeyValueGrid(doc, this.page.marginX, y + 32, this.page.contentWidth, [
      { label: 'Registration', value: this.formatText(data.aircraft.registration) },
      { label: 'Serial Number', value: this.formatText(data.aircraft.serial_number) },
      { label: 'Model', value: this.formatText(data.aircraft.model_name) },
      { label: 'Manufacturer', value: this.formatText(data.aircraft.manufacturer_name) },
      { label: 'Category', value: this.formatText(data.aircraft.category_label) },
      { label: 'Total Time Hours', value: this.formatNumber(data.aircraft.total_time_hours, 2) },
      { label: 'Total Time Cycles', value: this.formatNumber(data.aircraft.total_time_cycles, 0) },
      { label: 'Manufacture Date', value: this.formatText(data.aircraft.manufacture_date) },
      { label: 'TCDS Number', value: this.formatText(data.aircraft.tcds_number) },
      { label: 'TCDS Reference', value: this.formatText(data.aircraft.tcds_url) },
    ]);

    this.drawSectionTitle(
      doc,
      'Customer Information',
      this.page.marginX,
      y + 2,
      this.page.contentWidth
    );
    y = this.drawKeyValueGrid(doc, this.page.marginX, y + 30, this.page.contentWidth, [
      { label: 'Customer / Owner', value: this.formatText(data.customer.name) },
      { label: 'Relationship', value: this.formatText(data.customer.relationship_type) },
      { label: 'Contact Person', value: this.formatText(data.customer.contact_person) },
      { label: 'Email', value: this.formatText(data.customer.email) },
      { label: 'Phone', value: this.formatText(data.customer.phone) },
      { label: 'Alternate Phone', value: this.formatText(data.customer.alternate_phone) },
      { label: 'Account Reference', value: this.formatText(data.customer.account_reference) },
      { label: 'Visibility', value: this.formatText(data.customer.visibility) },
      { label: 'Billing Address', value: this.joinLines(data.customer.billing_address) },
      { label: 'Physical Address', value: this.joinLines(data.customer.physical_address) },
    ]);

    this.drawSectionTitle(
      doc,
      'Operational Scope Summary',
      this.page.marginX,
      y,
      this.page.contentWidth
    );

    const panelTop = y + 28;
    const gap = 14;
    const panelWidth = (this.page.contentWidth - gap * 2) / 3;

    this.drawSummaryPanel(
      doc,
      this.page.marginX,
      panelTop,
      panelWidth,
      'Task Scope',
      [
        { label: 'Total', value: this.formatNumber(data.operational_scope_summary.tasks.total, 0) },
        { label: 'Open', value: this.formatNumber(data.operational_scope_summary.tasks.open, 0) },
        {
          label: 'In Progress',
          value: this.formatNumber(data.operational_scope_summary.tasks.in_progress, 0),
        },
        {
          label: 'Certified',
          value: this.formatNumber(
            data.operational_scope_summary.tasks.certified_by_engineer,
            0
          ),
        },
        { label: 'Locked', value: this.formatNumber(data.operational_scope_summary.tasks.locked, 0) },
        {
          label: 'Standard / AD / SB / SID',
          value: `${this.formatNumber(data.operational_scope_summary.tasks.standard, 0)} / ${this.formatNumber(data.operational_scope_summary.tasks.ad, 0)} / ${this.formatNumber(data.operational_scope_summary.tasks.sb, 0)} / ${this.formatNumber(data.operational_scope_summary.tasks.sid, 0)}`,
        },
      ]
    );

    this.drawSummaryPanel(
      doc,
      this.page.marginX + panelWidth + gap,
      panelTop,
      panelWidth,
      'Compliance Scope',
      [
        { label: 'Total', value: this.formatNumber(data.operational_scope_summary.compliance.total, 0) },
        { label: 'Open', value: this.formatNumber(data.operational_scope_summary.compliance.open, 0) },
        {
          label: 'Completed',
          value: this.formatNumber(data.operational_scope_summary.compliance.completed, 0),
        },
        {
          label: 'AD Total / Complete',
          value: `${this.formatNumber(data.operational_scope_summary.compliance.ad_total, 0)} / ${this.formatNumber(data.operational_scope_summary.compliance.ad_completed, 0)}`,
        },
        {
          label: 'SB Total / Complete',
          value: `${this.formatNumber(data.operational_scope_summary.compliance.sb_total, 0)} / ${this.formatNumber(data.operational_scope_summary.compliance.sb_completed, 0)}`,
        },
        {
          label: 'Snapshot Complete Items',
          value: this.formatNumber(
            data.operational_scope_summary.compliance.completed_snapshot_items,
            0
          ),
        },
      ]
    );

    this.drawSummaryPanel(
      doc,
      this.page.marginX + (panelWidth + gap) * 2,
      panelTop,
      panelWidth,
      'Snag Scope',
      [
        { label: 'Total', value: this.formatNumber(data.operational_scope_summary.snags.total, 0) },
        { label: 'Open', value: this.formatNumber(data.operational_scope_summary.snags.open, 0) },
        {
          label: 'In Progress',
          value: this.formatNumber(data.operational_scope_summary.snags.in_progress, 0),
        },
        {
          label: 'Resolved',
          value: this.formatNumber(data.operational_scope_summary.snags.resolved, 0),
        },
        { label: 'Closed', value: this.formatNumber(data.operational_scope_summary.snags.closed, 0) },
        {
          label: 'Maintenance Type',
          value: this.formatText(data.operational_scope_summary.maintenance_type),
        },
      ]
    );

    y = panelTop + 108;

    this.drawSectionTitle(
      doc,
      'Issue / Revision Information',
      this.page.marginX,
      y,
      this.page.contentWidth
    );
    y = this.drawKeyValueGrid(doc, this.page.marginX, y + 28, this.page.contentWidth, [
      { label: 'Revision Number', value: this.formatNumber(data.issue_revision.revision_number, 0) },
      { label: 'Current Status Code', value: this.formatText(data.issue_revision.current_status_code) },
      { label: 'Issued At', value: this.formatDateTime(data.issue_revision.issued_at) },
      { label: 'Issued By', value: this.formatText(data.issue_revision.issued_by_name) },
      { label: 'Certified At', value: this.formatDateTime(data.issue_revision.certified_at) },
      { label: 'QA Reviewed At', value: this.formatDateTime(data.issue_revision.qa_reviewed_at) },
      { label: 'Released At', value: this.formatDateTime(data.issue_revision.released_at) },
      { label: 'Last Updated At', value: this.formatDateTime(data.issue_revision.last_updated_at) },
    ]);

    this.drawSectionTitle(
      doc,
      'Planner Information',
      this.page.marginX,
      y,
      this.page.contentWidth
    );
    this.drawKeyValueGrid(doc, this.page.marginX, y + 28, this.page.contentWidth, [
      { label: 'Planner Name', value: this.formatText(data.planner.full_name) },
      { label: 'Planner Email', value: this.formatText(data.planner.email) },
      { label: 'Planner Source', value: this.formatText(data.planner.selected_from) },
      { label: 'Planning Session Status', value: this.formatText(data.planner.planning_session_status) },
      { label: 'Maintenance Type', value: this.formatText(data.planner.planning_maintenance_type) },
      { label: 'Planning Finalized At', value: this.formatDateTime(data.planner.planning_finalized_at) },
      { label: 'Template Name', value: this.formatText(data.planner.template.name) },
      { label: 'Template Type', value: this.formatText(data.planner.template.type) },
    ]);
  }

  private static drawCoverFooter(
    doc: PDFKit.PDFDocument,
    context: Extract<PrintablePageContext, { kind: 'cover' }>,
    pageNumber: number,
    totalPages: number
  ) {
    const footerTop = this.page.height - 76;
    const x = this.page.marginX;

    doc
      .moveTo(x, footerTop)
      .lineTo(x + this.page.contentWidth, footerTop)
      .strokeColor(this.palette.line)
      .lineWidth(1)
      .stroke();

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Snapshot generated ${this.formatDateTime(context.generated_at)} | Source of truth: Jupiter database`,
        x,
        footerTop + 10,
        { width: 340 }
      );

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Status ${this.formatText(context.status_code)} | Revision ${this.formatNumber(
          context.revision_number,
          0
        )}`,
        x,
        footerTop + 24,
        { width: 220 }
      );

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`Page ${pageNumber} of ${totalPages}`, x + 400, footerTop + 18, {
        width: 120,
        align: 'right',
      });
  }

  private static drawTaskFooter(
    doc: PDFKit.PDFDocument,
    context: Extract<PrintablePageContext, { kind: 'task' }>,
    pageNumber: number,
    totalPages: number
  ) {
    const footerTop = this.page.height - 76;
    const x = this.page.marginX;

    doc
      .moveTo(x, footerTop)
      .lineTo(x + this.page.contentWidth, footerTop)
      .strokeColor(this.palette.line)
      .lineWidth(1)
      .stroke();

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Workpack ${this.formatText(context.workpack_reference)} | Task ${this.formatText(context.task_reference)} | Aircraft ${this.formatText(context.aircraft_registration)}`,
        x,
        footerTop + 10,
        { width: 360 }
      );

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(
        context.continuation
          ? 'Continuation page. Handwritten entries and signatures require controlled reconciliation in Jupiter.'
          : 'Operational task page. Handwritten entries and signatures require controlled reconciliation in Jupiter.',
        x,
        footerTop + 24,
        { width: 360 }
      );

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`Page ${pageNumber} of ${totalPages}`, x + 400, footerTop + 18, {
        width: 120,
        align: 'right',
      });
  }

  private static drawSnagFooter(
    doc: PDFKit.PDFDocument,
    context: Extract<PrintablePageContext, { kind: 'snag' }>,
    pageNumber: number,
    totalPages: number
  ) {
    const footerTop = this.page.height - 76;
    const x = this.page.marginX;

    doc
      .moveTo(x, footerTop)
      .lineTo(x + this.page.contentWidth, footerTop)
      .strokeColor(this.palette.line)
      .lineWidth(1)
      .stroke();

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Workpack ${this.formatText(context.workpack_reference)} | Snag ${this.formatText(context.snag_reference)} | Aircraft ${this.formatText(context.aircraft_registration)}`,
        x,
        footerTop + 10,
        { width: 360 }
      );

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(
        context.continuation
          ? 'Continuation page. Handwritten snag notes require controlled reconciliation in Jupiter.'
          : 'Operational snag page. Handwritten snag notes require controlled reconciliation in Jupiter.',
        x,
        footerTop + 24,
        { width: 360 }
      );

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`Page ${pageNumber} of ${totalPages}`, x + 400, footerTop + 18, {
        width: 120,
        align: 'right',
      });
  }

  private static finalizePageFooters(
    doc: PDFKit.PDFDocument,
    pageContexts: PrintablePageContext[]
  ) {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let index = 0; index < totalPages; index += 1) {
      const context = pageContexts[index];
      if (!context) {
        continue;
      }

      doc.switchToPage(index);

      if (context.kind === 'cover') {
        this.drawCoverFooter(doc, context, index + 1, totalPages);
      } else if (context.kind === 'task') {
        this.drawTaskFooter(doc, context, index + 1, totalPages);
      } else {
        this.drawSnagFooter(doc, context, index + 1, totalPages);
      }
    }
  }

  private static startTaskPage(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    continuationIndex: number
  ) {
    doc.addPage({
      margin: 0,
      size: this.page.size,
    });

    pageContexts.push({
      kind: 'task',
      workpack_reference: snapshot.workpack.work_order_number,
      task_reference: task.task_reference.task_reference,
      task_title: task.task.title,
      continuation: continuationIndex > 0,
      aircraft_registration: snapshot.workpack.aircraft_registration,
    });

    this.drawPageFrame(doc);
    this.drawTaskPageHeader(doc, snapshot, task, continuationIndex);

    return {
      y: this.taskLayout.contentTop,
      continuationIndex,
    };
  }

  private static ensureTaskSpace(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState,
    requiredHeight: number
  ) {
    if (state.y + requiredHeight <= this.taskLayout.contentBottom) {
      return state;
    }

    return this.startTaskPage(
      doc,
      snapshot,
      task,
      pageContexts,
      state.continuationIndex + 1
    );
  }

  private static drawTaskPageHeader(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    continuationIndex: number
  ) {
    const x = this.page.marginX;
    const title = continuationIndex > 0 ? 'TASK BODY CONTINUED' : 'TASK BODY';

    doc
      .fillColor(this.palette.strong)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(title, x, 36, { width: 220 });

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(
        continuationIndex > 0 ? 'CONTINUATION PAGE' : 'OPERATIONAL TASK PAGE',
        x,
        58,
        { width: 180 }
      );

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(this.formatText(task.task_reference.task_reference), 390, 38, {
        width: 170,
        align: 'right',
      });

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(task.task.title, x, 78, {
        width: this.page.contentWidth,
      });

    doc
      .save()
      .fillColor(this.palette.continuation)
      .roundedRect(x, 98, this.page.contentWidth, 26, 6)
      .fill()
      .restore();

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('AUTHORITY BOUNDARY', x + 8, 106, { width: 100 });

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Workpack ${this.formatText(snapshot.workpack.work_order_number)} | Lifecycle ${snapshot.authority.lifecycle_authority} | Certification ${snapshot.authority.certification_authority} | Mutation NOT PERMITTED`,
        x + 112,
        106,
        { width: this.page.contentWidth - 120 }
      );
  }

  private static startSnagPage(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    snag: PrintableWorkpackSnagSnapshot,
    pageContexts: PrintablePageContext[],
    continuationIndex: number
  ) {
    doc.addPage({
      margin: 0,
      size: this.page.size,
    });

    pageContexts.push({
      kind: 'snag',
      workpack_reference: snapshot.workpack.work_order_number,
      snag_reference: snag.snag.snag_no !== null ? `SNAG-${snag.snag.snag_no}` : snag.snag.id,
      continuation: continuationIndex > 0,
      aircraft_registration: snapshot.workpack.aircraft_registration,
    });

    this.drawPageFrame(doc);
    this.drawSnagPageHeader(doc, snapshot, snag, continuationIndex);

    return {
      y: this.taskLayout.contentTop,
      continuationIndex,
    };
  }

  private static ensureSnagSpace(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    snag: PrintableWorkpackSnagSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState,
    requiredHeight: number
  ) {
    if (state.y + requiredHeight <= this.taskLayout.contentBottom) {
      return state;
    }

    return this.startSnagPage(
      doc,
      snapshot,
      snag,
      pageContexts,
      state.continuationIndex + 1
    );
  }

  private static drawSnagPageHeader(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    snag: PrintableWorkpackSnagSnapshot,
    continuationIndex: number
  ) {
    const x = this.page.marginX;
    const title = continuationIndex > 0 ? 'SNAG SECTION CONTINUED' : 'SNAG SECTION';
    const snagReference =
      snag.snag.snag_no !== null ? `SNAG-${snag.snag.snag_no}` : snag.snag.id;

    doc
      .fillColor(this.palette.strong)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(title, x, 36, { width: 240 });

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(
        continuationIndex > 0 ? 'CONTINUATION PAGE' : 'OPERATIONAL SNAG PAGE',
        x,
        58,
        { width: 180 }
      );

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(this.formatText(snagReference), 390, 38, {
        width: 170,
        align: 'right',
      });

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(this.formatText(snag.description.defect_text), x, 78, {
        width: this.page.contentWidth,
      });

    doc
      .save()
      .fillColor(this.palette.continuation)
      .roundedRect(x, 98, this.page.contentWidth, 26, 6)
      .fill()
      .restore();

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('AUTHORITY BOUNDARY', x + 8, 106, { width: 100 });

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Workpack ${this.formatText(snapshot.workpack.work_order_number)} | Lifecycle ${snapshot.authority.lifecycle_authority} | Certification ${snapshot.authority.certification_authority} | Mutation NOT PERMITTED`,
        x + 112,
        106,
        { width: this.page.contentWidth - 120 }
      );
  }

  private static drawTaskSectionTitle(
    doc: PDFKit.PDFDocument,
    title: string,
    y: number
  ) {
    this.drawSectionTitle(
      doc,
      title,
      this.page.marginX,
      y,
      this.page.contentWidth
    );
  }

  private static drawBorderBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    doc
      .save()
      .fillColor('#ffffff')
      .strokeColor(this.palette.line)
      .lineWidth(1)
      .roundedRect(x, y, width, height, 6)
      .fillAndStroke()
      .restore();
  }

  private static fitTextToHeight(
    doc: PDFKit.PDFDocument,
    text: string,
    width: number,
    height: number,
    lineGap = 2
  ) {
    const normalized = this.normalizeParagraphs(text);

    if (!normalized) {
      return { fit: '', rest: '' };
    }

    if (doc.heightOfString(normalized, { width, lineGap }) <= height) {
      return { fit: normalized, rest: '' };
    }

    const words = normalized.split(/\s+/);
    let low = 1;
    let high = words.length;
    let best = 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = words.slice(0, mid).join(' ');
      const candidateHeight = doc.heightOfString(candidate, { width, lineGap });

      if (candidateHeight <= height) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (best <= 0) {
      best = 1;
    }

    return {
      fit: words.slice(0, best).join(' '),
      rest: words.slice(best).join(' ').trim(),
    };
  }

  private static drawLinedWritingArea(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string | null,
    minLineCount = 4
  ) {
    this.drawBorderBox(doc, x, y, width, height);

    const innerX = x + this.taskLayout.boxPadding;
    const innerY = y + this.taskLayout.boxPadding;
    const innerWidth = width - this.taskLayout.boxPadding * 2;
    const innerHeight = height - this.taskLayout.boxPadding * 2;
    const lineGap = 18;
    const normalized = this.normalizeParagraphs(text);

    doc
      .save()
      .strokeColor('#dbe4ee')
      .lineWidth(0.7);

    for (
      let lineY = innerY + lineGap;
      lineY <= y + height - this.taskLayout.boxPadding;
      lineY += lineGap
    ) {
      doc.moveTo(innerX, lineY).lineTo(innerX + innerWidth, lineY).stroke();
    }

    doc.restore();

    if (normalized) {
      doc
        .fillColor(this.palette.ink)
        .font('Helvetica')
        .fontSize(9)
        .text(normalized, innerX, innerY, {
          width: innerWidth,
          height: innerHeight,
          lineGap: 2,
        });
    } else {
      const placeholderLines = Math.max(minLineCount, Math.floor(innerHeight / lineGap) - 1);
      doc
        .fillColor(this.palette.muted)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(
          `Handwritten operational entries permitted in this area. ${placeholderLines > 0 ? 'Controlled reconciliation required before Jupiter truth changes.' : ''}`,
          innerX,
          innerY,
          {
            width: innerWidth,
            lineGap: 2,
          }
        );
    }
  }

  private static drawMeasurementTable(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    measurements: MeasurementDisplayRow[]
  ) {
    const rows =
      measurements.length > 0
        ? measurements
        : Array.from({ length: 4 }, (_, index) => ({
            field_label: `Measurement ${index + 1}`,
            reference_text: null,
            recorded_value: null,
          }));
    const headerHeight = 18;
    const rowHeight = 22;
    const totalHeight = headerHeight + rows.length * rowHeight + 12;
    const labelWidth = width * 0.36;
    const referenceWidth = width * 0.24;
    const valueWidth = width * 0.20;
    const handwrittenWidth = width - labelWidth - referenceWidth - valueWidth - 32;

    this.drawBorderBox(doc, x, y, width, totalHeight);

    doc
      .fillColor(this.palette.panel)
      .rect(x + 1, y + 1, width - 2, headerHeight)
      .fill();

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('FIELD', x + 10, y + 5, { width: labelWidth - 10 });

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('REFERENCE / LIMIT', x + labelWidth + 10, y + 5, {
        width: referenceWidth - 10,
      });

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('JUPITER VALUE', x + labelWidth + referenceWidth + 10, y + 5, {
        width: valueWidth - 10,
      });

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('HANDWRITTEN ENTRY', x + labelWidth + referenceWidth + valueWidth + 10, y + 5, {
        width: handwrittenWidth - 10,
      });

    doc.save().strokeColor(this.palette.line).lineWidth(0.8);
    doc
      .moveTo(x + labelWidth, y + 1)
      .lineTo(x + labelWidth, y + totalHeight - 1)
      .stroke();
    doc
      .moveTo(x + labelWidth + referenceWidth, y + 1)
      .lineTo(x + labelWidth + referenceWidth, y + totalHeight - 1)
      .stroke();
    doc
      .moveTo(x + labelWidth + referenceWidth + valueWidth, y + 1)
      .lineTo(x + labelWidth + referenceWidth + valueWidth, y + totalHeight - 1)
      .stroke();

    let rowY = y + headerHeight;
    for (const row of rows) {
      doc
        .moveTo(x + 1, rowY)
        .lineTo(x + width - 1, rowY)
        .stroke();

      doc
        .fillColor(this.palette.ink)
        .font('Helvetica')
        .fontSize(8)
        .text(this.formatText(row.field_label), x + 10, rowY + 6, {
          width: labelWidth - 16,
        });

      doc
        .fillColor(row.reference_text ? this.palette.ink : this.palette.muted)
        .font(row.reference_text ? 'Helvetica' : 'Helvetica-Oblique')
        .fontSize(8)
        .text(
          row.reference_text
            ? this.formatText(row.reference_text)
            : 'No separate authoritative reference value in current snapshot.',
          x + labelWidth + 10,
          rowY + 6,
          {
            width: referenceWidth - 16,
          }
        );

      doc
        .fillColor(row.recorded_value ? this.palette.ink : this.palette.muted)
        .font(row.recorded_value ? 'Helvetica' : 'Helvetica-Oblique')
        .fontSize(8)
        .text(
          row.recorded_value
            ? this.formatText(row.recorded_value)
            : 'No stored value',
          x + labelWidth + referenceWidth + 10,
          rowY + 6,
          {
            width: valueWidth - 16,
          }
        );

      doc
        .fillColor(this.palette.muted)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(
          'Write here if needed. Reconciliation required.',
          x + labelWidth + referenceWidth + valueWidth + 10,
          rowY + 6,
          {
            width: handwrittenWidth - 16,
          }
        );

      const lineY = rowY + rowHeight - 6;
      doc
        .moveTo(x + labelWidth + referenceWidth + valueWidth + 10, lineY)
        .lineTo(x + width - 10, lineY)
        .stroke();

      rowY += rowHeight;
    }
    doc.restore();

    return totalHeight;
  }

  private static drawToolControlTable(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    rows: ToolControlDisplayRow[]
  ) {
    const headerHeight = 18;
    const rowHeight = 30;
    const footerHeight = 18;
    const totalHeight = headerHeight + rows.length * rowHeight + footerHeight;
    const fieldWidth = width * 0.24;
    const referenceWidth = width * 0.24;
    const recordedWidth = width * 0.22;
    const handwrittenWidth = width - fieldWidth - referenceWidth - recordedWidth - 32;

    this.drawBorderBox(doc, x, y, width, totalHeight);

    doc
      .fillColor(this.palette.panel)
      .rect(x + 1, y + 1, width - 2, headerHeight)
      .fill();

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('FIELD', x + 10, y + 5, { width: fieldWidth - 10 });

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('AUTHORITATIVE REFERENCE', x + fieldWidth + 10, y + 5, {
        width: referenceWidth - 10,
      });

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('JUPITER SNAPSHOT', x + fieldWidth + referenceWidth + 10, y + 5, {
        width: recordedWidth - 10,
      });

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('HANDWRITTEN ENTRY', x + fieldWidth + referenceWidth + recordedWidth + 10, y + 5, {
        width: handwrittenWidth - 10,
      });

    doc.save().strokeColor(this.palette.line).lineWidth(0.8);
    doc
      .moveTo(x + fieldWidth, y + 1)
      .lineTo(x + fieldWidth, y + totalHeight - 1)
      .stroke();
    doc
      .moveTo(x + fieldWidth + referenceWidth, y + 1)
      .lineTo(x + fieldWidth + referenceWidth, y + totalHeight - 1)
      .stroke();
    doc
      .moveTo(x + fieldWidth + referenceWidth + recordedWidth, y + 1)
      .lineTo(x + fieldWidth + referenceWidth + recordedWidth, y + totalHeight - 1)
      .stroke();

    let rowY = y + headerHeight;
    for (const row of rows) {
      doc
        .moveTo(x + 1, rowY)
        .lineTo(x + width - 1, rowY)
        .stroke();

      doc
        .fillColor(this.palette.ink)
        .font('Helvetica')
        .fontSize(8)
        .text(this.formatText(row.field_label), x + 10, rowY + 6, {
          width: fieldWidth - 16,
        });

      doc
        .fillColor(row.authoritative_reference ? this.palette.ink : this.palette.muted)
        .font(row.authoritative_reference ? 'Helvetica' : 'Helvetica-Oblique')
        .fontSize(8)
        .text(
          row.authoritative_reference
            ? this.formatText(row.authoritative_reference)
            : 'No separate authoritative reference available in current snapshot.',
          x + fieldWidth + 10,
          rowY + 6,
          {
            width: referenceWidth - 16,
          }
        );

      doc
        .fillColor(row.recorded_value ? this.palette.ink : this.palette.muted)
        .font(row.recorded_value ? 'Helvetica' : 'Helvetica-Oblique')
        .fontSize(8)
        .text(
          row.recorded_value
            ? this.formatText(row.recorded_value)
            : 'No dedicated tool-control record stored in Jupiter snapshot.',
          x + fieldWidth + referenceWidth + 10,
          rowY + 6,
          {
            width: recordedWidth - 16,
          }
        );

      doc
        .fillColor(this.palette.muted)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(
          row.handwritten_prompt,
          x + fieldWidth + referenceWidth + recordedWidth + 10,
          rowY + 6,
          {
            width: handwrittenWidth - 16,
          }
        );

      const lineY = rowY + rowHeight - 6;
      doc
        .moveTo(x + fieldWidth + referenceWidth + recordedWidth + 10, lineY)
        .lineTo(x + width - 10, lineY)
        .stroke();

      rowY += rowHeight;
    }

    doc
      .moveTo(x + 1, rowY)
      .lineTo(x + width - 1, rowY)
      .stroke();
    doc.restore();

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(7)
      .text(
        'Operational handwriting only. Reconciliation required before any Jupiter tool-control truth changes.',
        x + 10,
        y + totalHeight - 12,
        {
          width: width - 20,
        }
      );

    return totalHeight;
  }

  private static extractMeasurementReferenceText(fieldLabel: string | null) {
    const label = String(fieldLabel || '').trim();
    if (!label) {
      return {
        field_label: 'Measurement',
        reference_text: null,
      };
    }

    const bracketMatch = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (bracketMatch) {
      return {
        field_label: String(bracketMatch[1] || '').trim() || label,
        reference_text: String(bracketMatch[2] || '').trim() || null,
      };
    }

    const squareMatch = label.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
    if (squareMatch) {
      return {
        field_label: String(squareMatch[1] || '').trim() || label,
        reference_text: String(squareMatch[2] || '').trim() || null,
      };
    }

    const separatorMatch = label.match(/^(.*?)\s*(?:-|:)\s*(MIN|MAX|REF|LIMIT|RANGE|TARGET)\s*(.*)$/i);
    if (separatorMatch) {
      const suffix = `${String(separatorMatch[2] || '').trim()} ${String(
        separatorMatch[3] || ''
      ).trim()}`.trim();
      return {
        field_label: String(separatorMatch[1] || '').trim() || label,
        reference_text: suffix || null,
      };
    }

    return {
      field_label: label,
      reference_text: null,
    };
  }

  private static buildMeasurementDisplayRows(
    measurements: PrintableWorkpackTaskMeasurementSnapshot[]
  ) {
    return measurements.map((measurement) => {
      const parsed = this.extractMeasurementReferenceText(measurement.field_label);

      return {
        field_label: parsed.field_label,
        reference_text: parsed.reference_text,
        recorded_value: measurement.value,
      };
    });
  }

  private static buildToolControlDisplayRows(
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot
  ) {
    return [
      {
        field_label: 'Workpack Association',
        authoritative_reference: 'Printable workpack scope',
        recorded_value: snapshot.workpack.work_order_number,
        handwritten_prompt: 'Issued to / returned from:',
      },
      {
        field_label: 'Task Association',
        authoritative_reference: 'Printable task scope',
        recorded_value: task.task_reference.task_reference,
        handwritten_prompt: 'Tool used for this task:',
      },
      {
        field_label: 'Compliance Reference',
        authoritative_reference: 'Compliance code',
        recorded_value: task.compliance_reference.code,
        handwritten_prompt: 'Reference matched on paper:',
      },
      {
        field_label: 'Reference Identifier',
        authoritative_reference: 'Service bulletin reference',
        recorded_value: task.compliance_reference.service_bulletin_reference,
        handwritten_prompt: 'Tool or kit identifier:',
      },
      {
        field_label: 'Tool Identifier / Serial',
        authoritative_reference: null,
        recorded_value: null,
        handwritten_prompt: 'Record tool ID or serial number here:',
      },
      {
        field_label: 'Calibration / Condition',
        authoritative_reference: null,
        recorded_value: null,
        handwritten_prompt: 'Record calibration due, condition, or check result:',
      },
      {
        field_label: 'Issue / Return Control',
        authoritative_reference: null,
        recorded_value: null,
        handwritten_prompt: 'Record qty, issue, return, and initials:',
      },
      {
        field_label: 'Exception / Note',
        authoritative_reference: null,
        recorded_value: null,
        handwritten_prompt: 'Record any exception. Controlled reconciliation required.',
      },
    ] satisfies ToolControlDisplayRow[];
  }

  private static drawSignoffPanel(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    title: string,
    recordedName: string | null,
    recordedAt: Date | null,
    signatures: PrintableWorkpackTaskSignatureSnapshot[]
  ) {
    const height = 94;

    this.drawBorderBox(doc, x, y, width, height);

    doc
      .fillColor(this.palette.accent)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(title.toUpperCase(), x + 10, y + 10, { width: width - 20 });

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Recorded name', x + 10, y + 28, { width: 90 });

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica')
      .fontSize(8)
      .text(this.formatText(recordedName), x + 104, y + 28, { width: width - 114 });

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Recorded at', x + 10, y + 42, { width: 90 });

    doc
      .fillColor(this.palette.ink)
      .font('Helvetica')
      .fontSize(8)
      .text(this.formatDateTime(recordedAt), x + 104, y + 42, { width: width - 114 });

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Evidence signatures', x + 10, y + 56, { width: 90 });

    const signatureText =
      signatures.length > 0
        ? signatures
            .map(
              (signature) =>
                `${this.formatText(signature.signer_name)} (${this.formatText(
                  signature.signature_type
                )} ${this.formatDateTime(signature.signed_at)})`
            )
            .join('; ')
        : 'No digital signature rendering. Handwritten evidence only if captured on paper, with later controlled reconciliation required.';

    doc
      .fillColor(signatures.length > 0 ? this.palette.ink : this.palette.muted)
      .font(signatures.length > 0 ? 'Helvetica' : 'Helvetica-Oblique')
      .fontSize(8)
      .text(signatureText, x + 104, y + 56, {
        width: width - 114,
      });

    doc.save().strokeColor('#dbe4ee').lineWidth(0.8);
    doc.moveTo(x + 10, y + 82).lineTo(x + width - 10, y + 82).stroke();
    doc.restore();

    doc
      .fillColor(this.palette.muted)
      .font('Helvetica')
      .fontSize(7)
      .text('Printed signoff support only. No lifecycle or certification authority is created on paper.', x + 10, y + 84, {
        width: width - 20,
      });

    return height;
  }

  private static drawSingleColumnKeyValue(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    fields: Array<{ label: string; value: string }>
  ) {
    let currentY = y;

    for (const field of fields) {
      doc
        .fillColor(this.palette.muted)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(field.label, x, currentY, { width: 132 });

      doc
        .fillColor(this.palette.ink)
        .font('Helvetica')
        .fontSize(9)
        .text(field.value, x + 138, currentY, {
          width: width - 138,
          lineGap: 1,
        });

      const rowHeight = Math.max(
        14,
        doc.heightOfString(field.value, {
          width: width - 138,
          lineGap: 1,
        })
      );
      currentY += rowHeight + 6;
    }

    return currentY;
  }

  private static renderReferenceSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    state = this.ensureTaskSpace(doc, snapshot, task, pageContexts, state, 110);
    const sectionTop = state.y;
    this.drawTaskSectionTitle(doc, 'Task Reference Information', sectionTop);

    const boxY = sectionTop + 22;
    const boxHeight = 78;
    this.drawBorderBox(doc, this.page.marginX, boxY, this.page.contentWidth, boxHeight);

    this.drawSingleColumnKeyValue(doc, this.page.marginX + 10, boxY + 10, this.page.contentWidth - 20, [
      { label: 'Workpack Reference', value: this.formatText(task.task_reference.workpack_reference) },
      { label: 'Task Reference', value: this.formatText(task.task_reference.task_reference) },
      { label: 'Aircraft Registration', value: this.formatText(task.task_reference.aircraft_registration) },
      { label: 'Aircraft Model / S/N', value: `${this.formatText(task.task_reference.aircraft_model)} / ${this.formatText(task.task_reference.aircraft_serial_number)}` },
      {
        label: 'Task Status / Source',
        value: `${this.formatText(task.task.task_status_code)} / ${this.formatText(
          task.task.source_classification
        )}`,
      },
    ]);

    state.y = boxY + boxHeight + this.taskLayout.sectionGap;
    return state;
  }

  private static renderComplianceSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    state = this.ensureTaskSpace(doc, snapshot, task, pageContexts, state, 110);
    const sectionTop = state.y;
    this.drawTaskSectionTitle(doc, 'Compliance Reference Area', sectionTop);

    const boxY = sectionTop + 22;
    const boxHeight = 78;
    this.drawBorderBox(doc, this.page.marginX, boxY, this.page.contentWidth, boxHeight);

    this.drawSingleColumnKeyValue(doc, this.page.marginX + 10, boxY + 10, this.page.contentWidth - 20, [
      { label: 'Compliance Type', value: this.formatText(task.compliance_reference.item_type) },
      { label: 'Reference Code', value: this.formatText(task.compliance_reference.code) },
      { label: 'Reference Title', value: this.formatText(task.compliance_reference.title) },
      { label: 'Authority / Revision', value: `${this.formatText(task.compliance_reference.authority)} / ${this.formatText(task.compliance_reference.revision)}` },
      { label: 'Compliance Basis', value: this.formatText(task.compliance_reference.compliance_basis) },
      { label: 'SB Reference', value: this.formatText(task.compliance_reference.service_bulletin_reference) },
    ]);

    state.y = boxY + boxHeight + this.taskLayout.sectionGap;
    return state;
  }

  private static renderTextSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState,
    title: string,
    text: string | null,
    options: {
      minHeight: number;
      writingArea?: boolean;
      placeholder?: string;
    }
  ) {
    let remaining = this.normalizeParagraphs(text);
    let firstChunk = true;

    while (true) {
      state = this.ensureTaskSpace(doc, snapshot, task, pageContexts, state, options.minHeight + 28);
      const sectionTop = state.y;
      this.drawTaskSectionTitle(
        doc,
        firstChunk ? title : `${title} (Continued)`,
        sectionTop
      );

      const boxY = sectionTop + 22;
      const availableHeight = this.taskLayout.contentBottom - boxY;
      const boxHeight = Math.max(options.minHeight, Math.min(availableHeight, 180));
      const innerWidth = this.page.contentWidth - this.taskLayout.boxPadding * 2;
      const innerHeight = boxHeight - this.taskLayout.boxPadding * 2;
      const { fit, rest } = this.fitTextToHeight(
        doc,
        remaining,
        innerWidth,
        Math.max(innerHeight - 4, 20)
      );
      const sectionText = fit || '';

      if (options.writingArea) {
        this.drawLinedWritingArea(
          doc,
          this.page.marginX,
          boxY,
          this.page.contentWidth,
          boxHeight,
          sectionText || null
        );
      } else {
        this.drawBorderBox(doc, this.page.marginX, boxY, this.page.contentWidth, boxHeight);

        doc
          .fillColor(sectionText ? this.palette.ink : this.palette.muted)
          .font(sectionText ? 'Helvetica' : 'Helvetica-Oblique')
          .fontSize(9)
          .text(
            sectionText || options.placeholder || '-',
            this.page.marginX + this.taskLayout.boxPadding,
            boxY + this.taskLayout.boxPadding,
            {
              width: innerWidth,
              height: innerHeight,
              lineGap: 2,
            }
          );
      }

      state.y = boxY + boxHeight + this.taskLayout.sectionGap;

      if (!rest) {
        return state;
      }

      remaining = rest;
      firstChunk = false;
      state = this.startTaskPage(
        doc,
        snapshot,
        task,
        pageContexts,
        state.continuationIndex + 1
      );
    }
  }

  private static renderMeasurementsSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    const rows = this.buildMeasurementDisplayRows(task.measurements.items);
    const fallbackRows =
      rows.length > 0
        ? rows
        : Array.from({ length: 4 }, (_, index) => ({
            field_label: `Measurement ${index + 1}`,
            reference_text: null,
            recorded_value: null,
          }));
    const rowsPerPage = 10;
    let chunkStart = 0;
    let firstChunk = true;

    while (chunkStart < fallbackRows.length) {
      const chunkRows = fallbackRows.slice(chunkStart, chunkStart + rowsPerPage);
      const estimatedHeight = 60 + Math.max(chunkRows.length, 4) * 22;
      state = this.ensureTaskSpace(doc, snapshot, task, pageContexts, state, estimatedHeight);

      const sectionTop = state.y;
      this.drawTaskSectionTitle(
        doc,
        firstChunk ? 'Measurements Area' : 'Measurements Area (Continued)',
        sectionTop
      );
      const boxY = sectionTop + 22;
      const boxHeight = this.drawMeasurementTable(
        doc,
        this.page.marginX,
        boxY,
        this.page.contentWidth,
        chunkRows
      );

      doc
        .fillColor(this.palette.muted)
        .font('Helvetica-Oblique')
        .fontSize(7)
        .text(
          'Printed measurements are downstream evidence only. Handwritten measurements require controlled reconciliation before Jupiter data changes.',
          this.page.marginX + 10,
          boxY + boxHeight - 16,
          {
            width: this.page.contentWidth - 20,
          }
        );

      state.y = boxY + boxHeight + this.taskLayout.sectionGap;
      chunkStart += rowsPerPage;
      firstChunk = false;

      if (chunkStart < fallbackRows.length) {
        state = this.startTaskPage(
          doc,
          snapshot,
          task,
          pageContexts,
          state.continuationIndex + 1
        );
      }
    }

    return state;
  }

  private static renderPartsMaterialsSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    const referenceText = [
      task.compliance_reference.service_bulletin_reference
        ? `Reference identifier: ${task.compliance_reference.service_bulletin_reference}`
        : '',
      'No dedicated authoritative task parts/materials records are present in the current Jupiter snapshot.',
      'Handwritten parts/materials entries are operational support only and require controlled reconciliation before Jupiter truth changes.',
    ]
      .filter(Boolean)
      .join('\n\n');

    return this.renderTextSection(
      doc,
      snapshot,
      task,
      pageContexts,
      state,
      'Parts / Materials Area',
      referenceText,
      {
        minHeight: 108,
        writingArea: true,
      }
    );
  }

  private static renderToolControlSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    const rows = this.buildToolControlDisplayRows(snapshot, task);
    const rowsPerPage = 4;
    let chunkStart = 0;
    let firstChunk = true;

    while (chunkStart < rows.length) {
      const chunkRows = rows.slice(chunkStart, chunkStart + rowsPerPage);
      const estimatedHeight = 58 + chunkRows.length * 30;
      state = this.ensureTaskSpace(doc, snapshot, task, pageContexts, state, estimatedHeight);

      const sectionTop = state.y;
      this.drawTaskSectionTitle(
        doc,
        firstChunk ? 'Tool Control Area' : 'Tool Control Area (Continued)',
        sectionTop
      );

      const boxY = sectionTop + 22;
      const boxHeight = this.drawToolControlTable(
        doc,
        this.page.marginX,
        boxY,
        this.page.contentWidth,
        chunkRows
      );

      state.y = boxY + boxHeight + this.taskLayout.sectionGap;
      chunkStart += rowsPerPage;
      firstChunk = false;

      if (chunkStart < rows.length) {
        state = this.startTaskPage(
          doc,
          snapshot,
          task,
          pageContexts,
          state.continuationIndex + 1
        );
      }
    }

    return state;
  }

  private static renderSignoffSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    task: PrintableWorkpackTaskBodyTaskSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    state = this.ensureTaskSpace(doc, snapshot, task, pageContexts, state, 146);

    const sectionTop = state.y;
    this.drawTaskSectionTitle(doc, 'Printed Signoff / Support Areas', sectionTop);

    const panelY = sectionTop + 22;
    const gap = 14;
    const panelWidth = (this.page.contentWidth - gap) / 2;

    this.drawSignoffPanel(
      doc,
      this.page.marginX,
      panelY,
      panelWidth,
      'Mechanic Signoff Support Area',
      task.mechanic_signoff_support.recorded_name,
      task.mechanic_signoff_support.recorded_at,
      task.mechanic_signoff_support.signatures
    );

    this.drawSignoffPanel(
      doc,
      this.page.marginX + panelWidth + gap,
      panelY,
      panelWidth,
      'Engineer Signoff Support Area',
      task.engineer_signoff_support.recorded_name,
      task.engineer_signoff_support.recorded_at,
      task.engineer_signoff_support.signatures
    );

    state.y = panelY + 94 + this.taskLayout.sectionGap;
    return state;
  }

  private static renderTaskPages(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    pageContexts: PrintablePageContext[]
  ) {
    snapshot.tasks.forEach((task) => {
      let state = this.startTaskPage(doc, snapshot, task, pageContexts, 0);

      state = this.renderReferenceSection(doc, snapshot, task, pageContexts, state);
      state = this.renderComplianceSection(doc, snapshot, task, pageContexts, state);
      state = this.renderTextSection(
        doc,
        snapshot,
        task,
        pageContexts,
        state,
        'Task Instructions Area',
        task.task_instructions.text,
        {
          minHeight: 96,
          placeholder: 'No structured instruction text captured in the current Jupiter snapshot.',
        }
      );
      state = this.renderTextSection(
        doc,
        snapshot,
        task,
        pageContexts,
        state,
        'Work Performed Area',
        task.work_performed.stored_text,
        {
          minHeight: 112,
          writingArea: true,
        }
      );
      state = this.renderMeasurementsSection(doc, snapshot, task, pageContexts, state);
      state = this.renderPartsMaterialsSection(
        doc,
        snapshot,
        task,
        pageContexts,
        state
      );
      state = this.renderToolControlSection(
        doc,
        snapshot,
        task,
        pageContexts,
        state
      );
      state = this.renderTextSection(
        doc,
        snapshot,
        task,
        pageContexts,
        state,
        'Findings / Notes Area',
        task.findings_notes.stored_text,
        {
          minHeight: 96,
          writingArea: true,
        }
      );
      this.renderSignoffSection(doc, snapshot, task, pageContexts, state);
    });
  }

  private static renderSnagReferenceSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    snag: PrintableWorkpackSnagSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    state = this.ensureSnagSpace(doc, snapshot, snag, pageContexts, state, 124);
    const sectionTop = state.y;
    this.drawTaskSectionTitle(doc, 'Snag Reference Information', sectionTop);

    const boxY = sectionTop + 22;
    const boxHeight = 92;
    const snagReference =
      snag.snag.snag_no !== null ? `SNAG-${snag.snag.snag_no}` : snag.snag.id;

    this.drawBorderBox(doc, this.page.marginX, boxY, this.page.contentWidth, boxHeight);
    this.drawSingleColumnKeyValue(
      doc,
      this.page.marginX + 10,
      boxY + 10,
      this.page.contentWidth - 20,
      [
        { label: 'Workpack Reference', value: this.formatText(snag.reference.workpack_reference) },
        { label: 'Snag Reference', value: this.formatText(snagReference) },
        { label: 'Aircraft Registration', value: this.formatText(snag.reference.aircraft_registration) },
        {
          label: 'Aircraft Model / S/N',
          value: `${this.formatText(snag.reference.aircraft_model)} / ${this.formatText(
            snag.reference.aircraft_serial_number
          )}`,
        },
        {
          label: 'Component Serial / Position',
          value: `${this.formatText(snag.reference.component_serial_number)} / ${this.formatText(
            snag.reference.component_position_code
          )}`,
        },
        {
          label: 'Status / Category / Priority',
          value: `${this.formatText(snag.snag.status_code)} / ${this.formatText(
            snag.snag.category
          )} / ${this.formatText(snag.snag.priority)}`,
        },
      ]
    );

    state.y = boxY + boxHeight + this.taskLayout.sectionGap;
    return state;
  }

  private static renderSnagStatusSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    snag: PrintableWorkpackSnagSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    state = this.ensureSnagSpace(doc, snapshot, snag, pageContexts, state, 150);
    const sectionTop = state.y;
    this.drawTaskSectionTitle(doc, 'Snag Description / Status Information', sectionTop);

    const boxY = sectionTop + 22;
    const boxHeight = 118;

    this.drawBorderBox(doc, this.page.marginX, boxY, this.page.contentWidth, boxHeight);
    this.drawSingleColumnKeyValue(
      doc,
      this.page.marginX + 10,
      boxY + 10,
      this.page.contentWidth - 20,
      [
        { label: 'Defect Text', value: this.formatText(snag.description.defect_text) },
        { label: 'Detail Description', value: this.formatText(snag.description.detail_text) },
        {
          label: 'Created / Started',
          value: `${this.formatDateTime(snag.lifecycle.created_at)} / ${this.formatDateTime(
            snag.lifecycle.started_at
          )}`,
        },
        {
          label: 'Resolved / Closed',
          value: `${this.formatDateTime(snag.lifecycle.resolved_at)} / ${this.formatDateTime(
            snag.lifecycle.closed_at
          )}`,
        },
        {
          label: 'Created / Assigned',
          value: `${this.formatText(snag.responsibility.created_by_name)} / ${this.formatText(
            snag.responsibility.assigned_to_name
          )}`,
        },
        {
          label: 'Started / Resolved / Closed',
          value: `${this.formatText(snag.responsibility.started_by_name)} / ${this.formatText(
            snag.responsibility.resolved_by_name
          )} / ${this.formatText(snag.responsibility.closed_by_name)}`,
        },
      ]
    );

    state.y = boxY + boxHeight + this.taskLayout.sectionGap;
    return state;
  }

  private static renderSnagResolutionSection(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    snag: PrintableWorkpackSnagSnapshot,
    pageContexts: PrintablePageContext[],
    state: TaskRenderState
  ) {
    const resolutionSummary = [
      snag.resolution.stored_text ? `Stored resolution: ${snag.resolution.stored_text}` : '',
      snag.resolution.parts_used ? `Parts used: ${snag.resolution.parts_used}` : '',
      snag.resolution.time_spent_minutes !== null
        ? `Time spent minutes: ${this.formatNumber(snag.resolution.time_spent_minutes, 0)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    return this.renderTextSection(
      doc,
      snapshot,
      {
        task: {
          id: snag.snag.id,
          task_card_number: null,
          title:
            snag.snag.snag_no !== null ? `Snag ${snag.snag.snag_no}` : `Snag ${snag.snag.id}`,
          task_status_code: snag.snag.status_code,
          execution_status_code: null,
          execution_attempt_no: null,
          source_classification: 'UNCLASSIFIED',
        },
        task_reference: {
          workpack_reference: snag.reference.workpack_reference,
          aircraft_registration: snag.reference.aircraft_registration,
          aircraft_serial_number: snag.reference.aircraft_serial_number,
          aircraft_model: snag.reference.aircraft_model,
          task_reference:
            snag.snag.snag_no !== null ? `SNAG-${snag.snag.snag_no}` : snag.snag.id,
        },
        compliance_reference: {
          item_type: null,
          code: null,
          title: null,
          authority: null,
          revision: null,
          compliance_basis: null,
          service_bulletin_reference: null,
        },
        task_instructions: {
          text: null,
        },
        work_performed: {
          stored_text: null,
          handwritten_reconciliation_required: true,
        },
        measurements: {
          items: [],
          handwritten_reconciliation_required: true,
        },
        findings_notes: {
          stored_text: null,
          handwritten_reconciliation_required: true,
        },
        mechanic_signoff_support: {
          recorded_name: null,
          recorded_at: null,
          signatures: [],
          evidence_only: true,
        },
        engineer_signoff_support: {
          recorded_name: null,
          recorded_at: null,
          signatures: [],
          evidence_only: true,
        },
      },
      pageContexts,
      state,
      'Snag Resolution / Notes Area',
      resolutionSummary || null,
      {
        minHeight: 120,
        writingArea: true,
      }
    );
  }

  private static renderSnagPages(
    doc: PDFKit.PDFDocument,
    snapshot: PrintableWorkpackTaskBodySnapshot,
    pageContexts: PrintablePageContext[]
  ) {
    snapshot.snags.forEach((snag) => {
      let state = this.startSnagPage(doc, snapshot, snag, pageContexts, 0);
      state = this.renderSnagReferenceSection(doc, snapshot, snag, pageContexts, state);
      state = this.renderSnagStatusSection(doc, snapshot, snag, pageContexts, state);
      this.renderSnagResolutionSection(doc, snapshot, snag, pageContexts, state);
    });
  }

  static async renderCoverPageForWorkpack(
    workpackId: string,
    transaction?: any
  ): Promise<Buffer> {
    const snapshot = await PrintableWorkpackService.getCoverPageDataForWorkpack(
      workpackId,
      transaction
    );

    return this.renderCoverPage(snapshot);
  }

  static async renderTaskBodyForWorkpack(
    workpackId: string,
    transaction?: any
  ): Promise<Buffer> {
    const snapshot = await PrintableWorkpackService.getTaskBodyDataForWorkpack(
      workpackId,
      transaction
    );

    return this.renderTaskBody(snapshot);
  }

  static async renderPrintableWorkpackForWorkpack(
    workpackId: string,
    transaction?: any
  ): Promise<Buffer> {
    const [coverSnapshot, taskSnapshot] = await Promise.all([
      PrintableWorkpackService.getCoverPageDataForWorkpack(workpackId, transaction),
      PrintableWorkpackService.getTaskBodyDataForWorkpack(workpackId, transaction),
    ]);

    return this.renderPrintableWorkpack(coverSnapshot, taskSnapshot);
  }

  static async renderCoverPage(
    data: PrintableWorkpackCoverPageSnapshot
  ): Promise<Buffer> {
    return this.toBuffer((doc) => {
      const pageContexts: PrintablePageContext[] = [
        {
          kind: 'cover',
          workpack_reference: data.workpack.work_order_number,
          status_code: data.workpack.status_code,
          revision_number: data.issue_revision.revision_number,
          generated_at: data.snapshot.generated_at,
        },
      ];

      this.drawCoverPageContent(doc, data);
      this.finalizePageFooters(doc, pageContexts);
    });
  }

  static async renderTaskBody(
    data: PrintableWorkpackTaskBodySnapshot
  ): Promise<Buffer> {
    return this.toBuffer((doc) => {
      const pageContexts: PrintablePageContext[] = [];
      doc.removePage(0);
      this.renderTaskPages(doc, data, pageContexts);
      this.renderSnagPages(doc, data, pageContexts);
      this.finalizePageFooters(doc, pageContexts);
    });
  }

  static async renderPrintableWorkpack(
    coverData: PrintableWorkpackCoverPageSnapshot,
    taskData: PrintableWorkpackTaskBodySnapshot
  ): Promise<Buffer> {
    return this.toBuffer((doc) => {
      const pageContexts: PrintablePageContext[] = [
        {
          kind: 'cover',
          workpack_reference: coverData.workpack.work_order_number,
          status_code: coverData.workpack.status_code,
          revision_number: coverData.issue_revision.revision_number,
          generated_at: coverData.snapshot.generated_at,
        },
      ];

      this.drawCoverPageContent(doc, coverData);
      this.renderTaskPages(doc, taskData, pageContexts);
      this.renderSnagPages(doc, taskData, pageContexts);
      this.finalizePageFooters(doc, pageContexts);
    });
  }
}
