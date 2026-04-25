import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { pool } from '../../config/database.js';

type PackRow = {
  id: string;
  work_order_number: string;
  registration: string;
  serial_number: string;
  release_hours: string | number | null;
  aircraft_model: string | null;
};

type MeasurementRow = {
  field_key: string | null;
  field_label: string | null;
  position: number | null;
  value: string | null;
};

type TaskRow = {
  task_card_number: string | null;
  title: string;
  description: string | null;
  work_performed: string | null;
  engineer_name: string | null;
  engineer_email: string | null;
  mechanic_name: string | null;
  certified_at: Date | string | null;
};

export class PdfService {
  private static readonly colors = {
    red: '#d22f3f',
    navy: '#17365d',
    blue: '#3b6ea5',
    black: '#000000',
    text: '#000000',
    muted: '#6b7280',
    line: '#cbd5e1',
    panel: '#f8fafc',
  };

  private static readonly assets = {
    badge: path.resolve(process.cwd(), 'docs', 'template', 'assets', 'whip-air-badge.png'),
    amoBadge: path.resolve(process.cwd(), 'docs', 'template', 'assets', 'amo-badge.png'),
    wing: path.resolve(process.cwd(), 'docs', 'template', 'assets', 'wing-mark.jpeg'),
  };

  private static fileIfExists(assetPath: string) {
    return fs.existsSync(assetPath) ? assetPath : null;
  }

  private static safeDate(value: Date | string | null | undefined) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB').format(date);
  }

  private static safeTime(value: Date | string | null | undefined) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private static cleanText(value: string | null | undefined) {
    return String(value || '')
      .replace(/\[Captured Values\][\s\S]*?\[\/Captured Values\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

// the red and blue outer frame
  private static drawFrame(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number) {
    doc.save();
    doc.lineWidth(2).strokeColor(this.colors.red).rect(x, y, w, h-120).stroke();
    doc.lineWidth(1).strokeColor(this.colors.navy).rect(x + 4, y + 4, w - 8, h - 128).stroke();
    doc.restore();
  }

  // Draw boxes
  private static drawBox(doc: PDFKit.PDFDocument, x: number, y: number, x1: number, y1: number) {
    doc.save();
    doc.lineWidth(1).strokeColor(this.colors.navy).rect(x, y, x1, y1).stroke();
    doc.restore();
  }

  // Draw table rows with dynamic cell heights
  private static drawRow(
  doc: PDFKit.PDFDocument,
  data: string[],
  x: number,
  y: number,
  colWidths: number[],
  options?: {    
    rowhght?: number,
    paddingX?: number;
    paddingY?: number;
    font?: string;
    size?: number;
    fitToWidth?: number; // 🔥 NEW (contentW)
  }
) {
  const paddingX = options?.paddingX ?? 3;
  const paddingY = options?.paddingY ?? 3;
  const font = options?.font ?? 'Helvetica';
  const size = options?.size ?? 8;

  doc.font(font).fontSize(size);

  // 🔥 AUTO-SIZE + FIT (if requested)
  if (options?.fitToWidth) {
    const rawWidths = data.map(text =>
      doc.widthOfString(text) + paddingX * 2 + 4
    );

    const totalRaw = rawWidths.reduce((a, b) => a + b, 0);

    const scale = options.fitToWidth / totalRaw;

    colWidths = rawWidths.map(w => w * scale);
  }

  // 🔥 calculate natural heights
  const heights = data.map((text, i) => {
    const usableWidth = (colWidths[i] || 0) - paddingX * 2;

    return doc.heightOfString(text, {
      width: usableWidth,
    }) + paddingY * 2;
  });

  // ✅ use fixed height if provided
  const rowHeight = options?.rowhght ?? Math.max(...heights);

  let currentX = x;

  for (let i = 0; i < data.length; i++) {
    const w = colWidths[i] || 0;
    const usableWidth = w - paddingX * 2;

    // 🔲 draw box
    doc
      .rect(currentX, y, w, rowHeight)
      .strokeColor(this.colors.navy)
      .lineWidth(1)
      .stroke();

    // 🔥 FIXED CENTERING (your working logic)
    const maxTextHeight = rowHeight - paddingY * 2;

    const textHeight = doc.heightOfString(data[i] || '', {
      width: usableWidth,
    });

    const effectiveHeight = Math.min(textHeight, maxTextHeight);

    const textY = y + paddingY + (maxTextHeight - effectiveHeight) / 2;

    // 📝 draw text
    doc
      .fillColor(this.colors.text)
      .text(data[i] || '', currentX + paddingX, textY, {
        width: usableWidth,
        height: maxTextHeight,
        align: 'center',
        ellipsis: true,
      });

    currentX += w;
  }

  return rowHeight;
}

//-------------------------- Draw row boxes for title value side by side  ----------------------
private static drawRowSbs(
  doc: PDFKit.PDFDocument,
  pairs: { label: string; value: string }[],
  x: number,
  y: number,
  contentWidth: number,
  options?: {
    rowhght?: number;
    paddingX?: number;
    paddingY?: number;
    labelFont?: string;
    valueFont?: string;
    size?: number;
  }
) {
  const paddingX = options?.paddingX ?? 3;
  const paddingY = options?.paddingY ?? 3;
  const size = options?.size ?? 8;

  const labelFont = options?.labelFont ?? 'Helvetica-Bold';
  const valueFont = options?.valueFont ?? 'Helvetica';

  doc.fontSize(size);

  // 🔥 STEP 1 — measure label widths
  doc.font(labelFont);

  const labelWidths = pairs.map(p =>
    doc.widthOfString(p.label) + paddingX * 2 + 6
  );

  // 🔥 STEP 2 — define MIN value width (fits max expected number)
  doc.font(valueFont);

  const minValueWidth =
    doc.widthOfString('99999.99') + paddingX * 2 + 6;

  // 🔥 STEP 3 — total required width
  const totalLabels = labelWidths.reduce((a, b) => a + b, 0);
  const totalValues = minValueWidth * pairs.length;

  const totalRequired = totalLabels + totalValues;

  // 🔥 STEP 4 — scale only if needed
  let scale = 1;

  if (totalRequired > contentWidth) {
    scale = contentWidth / totalRequired;
  }

  // 🔥 STEP 5 — build column widths
  const colWidths: number[] = [];

  for (let i = 0; i < pairs.length; i++) {
    colWidths.push((labelWidths[i] || 0) * scale);
    colWidths.push(minValueWidth * scale);
  }

  // 🔥 STEP 6 — calculate row height
  const heights = pairs.flatMap((p, i) => {
    const labelW = (colWidths[i * 2] || 0) - paddingX * 2;
    const valueW = (colWidths[i * 2 + 1] || 0) - paddingX * 2;

    doc.font(labelFont);
    const lh =
      doc.heightOfString(p.label, { width: labelW }) +
      paddingY * 2;

    doc.font(valueFont);
    const vh =
      doc.heightOfString(p.value, { width: valueW }) +
      paddingY * 2;

    return [lh, vh];
  });

  const rowHeight = options?.rowhght ?? Math.max(...heights);

  // 🔥 STEP 7 — draw
  let currentX = x;

  for (let i = 0; i < pairs.length; i++) {
    const labelW = colWidths[i * 2] || 0;
    const valueW = colWidths[i * 2 + 1] || 0;

    // 🔲 LABEL CELL
    doc
      .rect(currentX, y, labelW, rowHeight)
      .strokeColor(this.colors.navy)
      .lineWidth(1)
      .stroke();

    doc.font(labelFont).fillColor(this.colors.text);

    doc.text(pairs[i]?.label || '', currentX + paddingX, y + paddingY, {
      width: labelW - paddingX * 2,
      align: 'center',
    });

    currentX += labelW;

    // 🔲 VALUE CELL
    doc
      .rect(currentX, y, valueW, rowHeight)
      .strokeColor(this.colors.navy)
      .lineWidth(1)
      .stroke();

    doc.font(valueFont).fillColor(this.colors.text);

    doc.text(pairs[i]?.value || '', currentX + paddingX, y + paddingY, {
      width: valueW - paddingX * 2,
      align: 'center',
    });

    currentX += valueW;
  }

  return rowHeight;
}
//----------------------------------------------------------------------------------------------
  // Draw Text boxes
private static drawTextBox(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options?: {
    paddingX?: number;
    paddingY?: number;
    font?: string;
    size?: number;
  }
) {
  const paddingX = options?.paddingX ?? 4;
  const paddingY = options?.paddingY ?? 2;

  const font = options?.font ?? 'Helvetica';
  const size = options?.size ?? 8;

  // 👉 set font BEFORE measuring
  doc.font(font).fontSize(size);

  const textWidth = doc.widthOfString(text);
  const textHeight = doc.heightOfString(text);

  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = textHeight + paddingY * 2;

  // 🔲 Draw box
  doc
    .save()
    .lineWidth(1)
    .strokeColor(this.colors.navy)
    .rect(x, y, boxWidth, boxHeight)
    .stroke()
    .restore();

  // 📝 Draw text inside box
  doc
    .fillColor(this.colors.text)
    .text(text, x + paddingX, y + paddingY);

  return {
    width: boxWidth,
    height: boxHeight,
  };
}

  private static drawSectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number, w: number) {
    doc
      .save()
      .fillColor(this.colors.navy)
      .rect(x, y, w, 18)
      .fill()
      .restore();

    doc
      .fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(title.toUpperCase(), x + 8, y + 5, { width: w - 16, align: 'left' });
  }

private static drawKeyValueRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number,
  valueWidth: number,
  options?: { bold?: boolean; size?: number }
) {
  // ---- VALUE STYLE FIRST (so we measure correctly)
  if (options?.bold) {
    doc.font('Helvetica-Bold');
  } else {
    doc.font('Helvetica');
  }

  if (options?.size) {
    doc.fontSize(options.size);
  } else {
    doc.fontSize(9);
  }

  const valueHeight = doc.heightOfString(value || '-', {
    width: valueWidth,
  });

  // ---- LABEL (fixed style)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(this.colors.text);

  const labelHeight = doc.heightOfString(label, {
    width: labelWidth,
  });

  // 🔥 CENTER LABEL VERTICALLY RELATIVE TO VALUE
  const labelY = y + (valueHeight - labelHeight) / 2;

  doc.text(label, x, labelY, {
    width: labelWidth,
  });

  // ---- VALUE (draw after measuring)
  if (options?.bold) {
    doc.font('Helvetica-Bold');
  } else {
    doc.font('Helvetica');
  }

  if (options?.size) {
    doc.fontSize(options.size);
  } else {
    doc.fontSize(9);
  }

  doc.text(value || '-', x + labelWidth, y, {
    width: valueWidth,
  });
}

  static async generateCRS(workpackId: string): Promise<Buffer> {
    const { rows: packs } = await pool.query<PackRow>(
      `SELECT
         w.id,
         w.work_order_number,
         a.registration,
         a.serial_number,
         a.total_time_hours AS release_hours,
         cm.model_name AS aircraft_model
       FROM workpacks w
       JOIN aircraft a ON w.aircraft_id = a.id
       LEFT JOIN component_models cm ON a.model_id = cm.id
       WHERE w.id = $1`,
      [workpackId]
    );

    const { rows: tasks } = await pool.query<TaskRow>(
      `SELECT
         t.task_card_number,
         t.title,
         t.description,
         t.work_performed,
         t.engineer_certified_at AS certified_at,
         engineer.full_name AS engineer_name,
         engineer.email AS engineer_email,
         mechanic.full_name AS mechanic_name
       FROM task_cards t
       JOIN workpack_tasks wt ON t.id = wt.task_id
       LEFT JOIN users engineer ON engineer.id = t.engineer_certified_by
       LEFT JOIN users mechanic ON mechanic.id = t.mechanic_completed_by
       WHERE wt.workpack_id = $1
         AND t.status IN ('CERTIFIED_BY_ENGINEER', 'LOCKED')
       ORDER BY t.task_card_number ASC, t.created_at ASC`,
      [workpackId]
    );

    if (!packs.length) {
      throw new Error('Workpack not found for PDF generation');
    }

    const pack = packs[0]!;
    const normalizedTasks = tasks.map((task) => {
      return {
        ...task,
        description: this.cleanText(task.description),
        work_performed: this.cleanText(task.work_performed),
      };
    });
    const releaseAnchor = normalizedTasks.find((task) => task.certified_at) || null;
    const releaseDate = this.safeDate(releaseAnchor?.certified_at || new Date());
    const releaseTime = this.safeTime(releaseAnchor?.certified_at || new Date());
    const certifierName = releaseAnchor?.engineer_name || 'Engineer not recorded';
    const certifierEmail = releaseAnchor?.engineer_email || '';
    const badgePath = this.fileIfExists(this.assets.badge);
    const amoBadgePath = this.fileIfExists(this.assets.amoBadge);
    const wingPath = this.fileIfExists(this.assets.wing);

    const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape'});
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      console.log(`Page dimensions: W ${pageWidth} x H ${pageHeight}`);
      const frameX = 20;   //Top left corner of the outer frame x axis
      const frameY = 20;   //Top left corner of the outer frame y axis
      const frameW = pageWidth - 25;  //Bottom right corner of the outer frame x axis (width)
      const frameH = pageHeight - 20; //Bottom right corner of the outer frame y axis (height)
      const pgmid = pageWidth/2; 
      const contentX = frameX + 18;
      const contentW = frameW - 36;
      let y = frameY + 18;

     // Draw the outer red and blue frame
      this.drawFrame(doc, frameX, frameY, frameW, frameH);

      //------------CRMA No heading and number boxes----------------
      this.drawBox(doc, frameW-180, frameY+8,  frameW-756, frameY+11);
      doc
        .fillColor(this.colors.red)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('CRMA No', pageWidth - 195, frameY+12 , {
          width: 40,
          align: 'center',
        });
      this.drawBox(doc, frameW-120, frameY+8,  frameW-685, frameY+11);
      doc
        .fillColor(this.colors.red)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(pack.work_order_number, pageWidth - 140, frameY+15);
      
      //--------- Job No heading and number boxes----------------
      this.drawBox(doc, frameW-120, frameY+40, frameW-685, frameY+12);
      doc
        .fillColor(this.colors.red)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(pack.work_order_number, pageWidth - 140, frameY+50);
      this.drawBox(doc, frameW-180, frameY+40,  frameW-756, frameY+12);
      doc
        .fillColor(this.colors.red)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('JOB No', pageWidth - 195, frameY+44 , {
          width: 40,
          align: 'center',
        });
        
      //------------------ Draw the wing watermark if available (behind all content) ----------------------

      if (wingPath) {
        doc.save().opacity(0.08).image(wingPath, frameX, frameY-80, { width: pageWidth - 30 }).restore();
      }

      //----------------------Draw Whip-Air badge --------------------------------

      if (badgePath) {
        doc.image(badgePath, contentX-10, y-10, { width: 74, height: 74 });
      }

//-----------------------ADDRESS AND CONTACT DETAILS --------------------------------
 doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('Hangar 1', frameX + 90, y-5);

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('Diemerskraal,', frameX + 90, y + 5) ;    

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('R45,', frameX + 90, y + 15) ;

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('Wellington.', frameX + 90, y + 25) ; 

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('Tel: 083 458 4854', frameX + 90, y + 35) ; 

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('email: admin@whip-air.com', frameX + 90, y + 45) ; 

//--------------------------------------------------------------------------------------
      let titletx = 'WHIP-AIR Aviation, AMO 1386';
      doc.font('Helvetica-Bold').fontSize(22);
      let titlewidth = doc.widthOfString(titletx);
      let strtx = pgmid - (titlewidth / 2);
      y -= 10;
      doc.text(titletx, strtx, y); // ❗ NO width option
      y += 20;
      let srtln = strtx-40;
      let lnend = strtx + (titlewidth)+40;
      doc
        .moveTo(srtln, y )
        .lineTo(lnend, y)
        .strokeColor(this.colors.text)
        .stroke();
     
//--------------------------------------------------------------------------------------
      y += 10;

    //  titletx = 'CERTIFICATE RELATING TO MAINTENANCE OF AN AIRCRAFT';
      titletx = 'Certificate Relating To Maintenance Of An Aircraft';
      titlewidth = doc.widthOfString(titletx);
      strtx = (pgmid)-(titlewidth / 2);

      doc.font('Helvetica-Bold').fontSize(15);

      titlewidth = doc.widthOfString(titletx);
      strtx = pgmid - (titlewidth / 2);

      doc.text(titletx, strtx, y); 
      y += 20;
      doc
        .moveTo(srtln, y)
        .lineTo(lnend, y)
        .strokeColor(this.colors.text)
        .stroke();

    //-------------- Logbook -------------------------------
      y+=5;
      titletx = 'LOGBOOK INSERT';
      doc.font('Helvetica-Bold').fontSize(9);
      titlewidth = doc.widthOfString(titletx);
      strtx = pgmid - (titlewidth / 2);

      doc.text(titletx, strtx, y); 
      y += 10;
      doc
        .moveTo(strtx, y)
        .lineTo(strtx + (titlewidth), y)
        .strokeColor(this.colors.text)
        .stroke();
        
      y+=6;

      titletx = 'This constitutes an official logbook entry and must be affixed in the aircraft logbook.';
      doc.font('Helvetica').fontSize(8);
      titlewidth = doc.widthOfString(titletx);
      strtx = pgmid - (titlewidth / 2);

      doc.text(titletx, strtx, y); 
      y += 8;
      doc
        .moveTo(contentX-6, y)
        .lineTo(contentW+46, y)
        .strokeColor(this.colors.text)
        .stroke();
//---------------------Aircraft Details--------------------------------------------------
y += 2;

// 🔷 define columns
const labels = [
  'A/C Reg.',
  'A/C Type',
  'A/C S/N',
  'Engine Make/Type.',
  'Engine S/N.',
  'Prop Make/Type.',
  'Prop S/N.',
];

// 🔷 equal column widths spanning full contentW
const colWidth = contentW / labels.length;
const colWidths = labels.map(() => colWidth);

// 🔷 HEADER ROW (draw ONCE)
let rowHeight = this.drawRow(doc, labels, contentX, y, colWidths, {
  rowhght: 10,
  font: 'Helvetica-Bold',
  size: 8,
});

// move down using actual height
y += rowHeight;

// 🔷 VALUE ROW
const values = [
  pack.registration,
  pack.aircraft_model || 'N/A',
  pack.serial_number,
  'Continental O-200-A',
  '251893',
  'McCauley 1A102/OCM6948',
  'K21180',
];

// draw ONCE
rowHeight = this.drawRow(doc, values, contentX, y, colWidths, {
  rowhght: 10,
  font: 'Helvetica',
  size: 8,
});

// move down again if needed
y += rowHeight;
y += 1; // spacing before pairs section

// 🔷 data
const pairs = [
  { label: 'A/F Hrs', value: '8225.3' },
  { label: 'Tacho Hrs', value: '8225.3' },
  { label: 'Hobbs Hrs', value: 'N/A' },
  { label: 'ENG TT Hrs.', value: '5301.60' },
  { label: 'S.O.', value: '77.5' },
  { label: 'Prop TT Hrs.', value: 'UKN' },
  { label: 'S.O.', value: '0.00' },
];

// 🔷 third row uses the same total width as the two rows above,
// but splits that width into 14 cells (label/value for each pair)
const detailCells = pairs.flatMap(pair => [pair.label, pair.value]);
const detailColWidth = contentW / detailCells.length;
const detailColWidths = Array(detailCells.length).fill(detailColWidth);

rowHeight = this.drawRow(doc, detailCells, contentX, y, detailColWidths, {
  rowhght: 10,
  paddingX: 2,
  paddingY: 2,
  size: 8,
});

y += rowHeight;
 
      doc.end();
    });
  }
}
