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
    text: '#000308',
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
  value: string | null | undefined,
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
      console.log(`Page dimensions: ${pageWidth} x ${pageHeight}`);
      const frameX = 30;
      const frameY = 24;
      const frameW = pageWidth - 60;
      const frameH = pageHeight - 300;

      this.drawFrame(doc, frameX, frameY, frameW, frameH);

      if (wingPath) {
        doc.save().opacity(0.08).image(wingPath, 28, 30, { width: pageWidth - 60 }).restore();
      }

      const contentX = frameX + 18;
      const contentW = frameW - 36;
      let y = frameY + 18;

      if (badgePath) {
        doc.image(badgePath, contentX, y, { width: 74, height: 74 });
      }

      doc
        .fillColor(this.colors.text)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('WHIP-AIR Aviation, AMO 1386', contentX + 88, y + 8, {
          width: contentW - 220,
          align: 'center',
        });

      doc
        .fillColor(this.colors.navy)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('CERTIFICATE OF RELEASE TO SERVICE', contentX + 88, y + 43, {
          width: contentW - 220,
          align: 'center',
        });

      doc
        .fillColor(this.colors.red)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(pack.work_order_number, pageWidth - 180, y + 5, {
          width: 120,
          align: 'left',
        });      

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('Hangar 1', pageWidth - 170, y + 25, {
          width: 100,
          align: 'left',
        });      

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('Diemerskraal,', pageWidth - 170, y + 33, {
          width: 100,
          align: 'left',
        });      

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('R45,', pageWidth - 170, y + 41, {
          width: 100,
          align: 'left',
        });      

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('Wellington.', pageWidth - 170, y + 49, {
          width: 100,
          align: 'left',
        });      

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('Tel: 083 458 4854', pageWidth - 170, y + 57, {
          width: 100,
          align: 'left',
        });      

      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('email: admin@whip-air.com', pageWidth - 170, y + 64, {
          width: 150,
          align: 'left',
        });

      y += 78;

      doc.save().fillColor(this.colors.panel).rect(contentX, y, contentW, 42).fill().restore();
      doc.lineWidth(1).strokeColor(this.colors.line).rect(contentX, y, contentW, 42).stroke();

      this.drawKeyValueRow(doc,'NATIONALITY AND REGISTRATION MARKS: ',pack.registration,
            contentX + 10,y + 5,200,200,{ bold: true, size: 14 });      
      this.drawKeyValueRow(doc,'AIRCRAFT TYPE: ', pack.aircraft_model || 'Unknown model',
            contentX + 50,y + 27,78,100,{ bold: true, size: 12 });  
      this.drawKeyValueRow(doc,'SERIAL NUMBER: ', pack.serial_number || 'Unknown serial number',
            contentX + 300, y + 27,90,100,{ bold: true, size: 12 }); 

      y += 56;

       doc
        .fillColor(this.colors.black)
        .font('Helvetica')
        .fontSize(10)
        .text('I hereby certify that I am satisfied that the above mentioned aircraft and all its equipment are in every way servicable for flight and that all maintenance I.A.W. Civil Aviation Regulations and the approved maintenance schedule has been carried out.', 
          contentX + 5, y , {
          width: contentW ,
          align: 'left',
        });

        y += 46;

      this.drawSectionTitle(doc, 'CERTIFICATE LAPSES', contentX, y, contentW);
      y += 22;

      const statementH = 110;
      doc.lineWidth(1).strokeColor(this.colors.line).rect(contentX, y, contentW, statementH).stroke();
      y += 13;
      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(10)
        .text('THIS CERTIFICATE LAPSES AT A TOTAL OF ',
          contentX + 5, y , {
          width: contentW ,
          align: 'left',
        });

      doc
      .fillColor(this.colors.text)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(
          `*(Airframe) ${pack.release_hours ? `${pack.release_hours} hours` : 'unknown hours'}`,
      contentX + 225,
      y - 5,
      {
        width: contentW,
        align: 'left',
      }
    );    

      doc
      .fillColor(this.colors.text)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(
          `*(Tacho) ${pack.release_hours ? `${pack.release_hours} hours` : 'unknown hours'}`,
      contentX + 225,
      y + 7,
      {
        width: contentW,
        align: 'left',
      }
    );
    
      doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(10)
        .text('HRS OF FLIGHT TIME', 
          contentX + 365, y , {
          width: contentW ,
          align: 'left',
        });

        y += 18;
 
        const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
        : 'Unknown date';

        doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(10)
        .text('OR ON THE DATE OF ' , 
          contentX + 5, y , {
          width: contentW ,
          align: 'left',
        });

        doc
        .fillColor(this.colors.text)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(formattedDate, 
          contentX + 115, y , {
          width: 90 ,
          align: 'center',
        });
        
        doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(10)
        .text('WHICH EVER OCCURS FIRST, UNLESS THE AIRCRAFT IS ', 
          contentX + 210, y , {
          width: 300 ,
          align: 'left',
        });

        
        y += 18;

        doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(10) 
        .text('INVOLVED IN AN ACCIDENT OR BECOMES UNSERVISABLE IN WHICH CASE THIS CERTIFICATE IS',
          contentX + 5, y , {
          width: contentW +200,
          align: 'left',
        });

        y += 14;

        doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(10)
        .text('INVALID FOR THE DURATION OF THE PERIOD.',
          contentX+5 , y , {
          width: contentW +200,
          align: 'left',
        });

        y += 20;

        doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('The validity of this release to service is only current if the certificate of airworthiness has not expired.',
          contentX, y , {
          width: contentW,
          align: 'center',
        });
        y += 8;

        doc
        .fillColor(this.colors.text)
        .font('Helvetica')
        .fontSize(8)
        .text('* Providing a 50hr inspection was carried out if applicable.',
          contentX , y , {
          width: contentW ,
          align: 'center',
        });
        y += statementH;

      const certH = 30;
    
      y -=85;
    doc.lineWidth(1).strokeColor(this.colors.line).rect(contentX, y, contentW, statementH-40).stroke(); //Box for signature and release details
    this.drawKeyValueRow(doc, 'Signed:',null, contentX+10 , y + 12, 74, 80);
      
      doc
        .moveTo(contentX + 60, y + 20)
        .lineTo(contentX + 160, y + 20)
        .strokeColor(this.colors.text)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(this.colors.muted)
        .text('Authorised signature', contentX + 30, y + 25, {
          width: 170,
          align: 'center',
        });

      this.drawKeyValueRow(doc, 'Licence #:', '', contentX + 300, y +12 , 74, 120);
      this.drawKeyValueRow(doc, 'Release Date:', releaseDate, contentX + 10, y + 50, 74, 120);
      this.drawKeyValueRow(doc, 'Release Time:', releaseTime, contentX + 300, y + 50, 74, 120);
      if (amoBadgePath) {
        doc.save();
        doc.rotate(14, {origin: [contentX + 350 + 35, y + 5 + 35] // rotate around image center
        });
       // doc.save().opacity(0.18).image(amoBadgePath, 5, 200, { width: 70 }).restore();
        doc.opacity(0.6).image(amoBadgePath, contentX + 350, y + 10, { width: 70 });
        doc.restore();
      }
      doc.end();
    });
  }
}
