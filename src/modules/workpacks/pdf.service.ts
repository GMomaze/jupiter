import PDFDocument from 'pdfkit';
import { pool } from '../../config/database.js';

export class PdfService {
  static async generateCRS(workpackId: string): Promise<Buffer> {
    // 1. Fetch Pack and Aircraft Meta (Using 'total_time_hours' from DNA)
    const { rows: packs } = await pool.query(
      `SELECT w.*, a.registration, a.model, a.serial_number, a.total_time_hours as release_hours
       FROM workpacks w 
       JOIN aircraft a ON w.aircraft_id = a.id 
       WHERE w.id = $1`, [workpackId]
    );

    // 2. Fetch Tasks and QA sign-offs
    // ALIGNMENT: Using 'row_id' to match your Audit Engine
    const { rows: tasks } = await pool.query(
      `SELECT t.title, t.description, al.actor_id, al.created_at as signed_date
       FROM task_cards t
       JOIN workpack_tasks wt ON t.id = wt.task_id
       JOIN audit_log al ON al.row_id = t.id::text
       WHERE wt.workpack_id = $1 AND al.new_values->>'status' = 'LOCKED'
       ORDER BY t.created_at ASC`, 
      [workpackId]
    );

    if (!packs.length) throw new Error('Workpack not found for PDF generation');
    const pack = packs[0];

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header & Branding
      doc.fontSize(20).text('CERTIFICATE OF RELEASE TO SERVICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Work Order: ${pack.work_order_number}`, { align: 'right' });
      doc.text(`Release Date: ${new Date().toISOString().split('T')[0]}`, { align: 'right' });

      // Aircraft Block
      doc.moveDown().fontSize(14).text('Aircraft Identification', { underline: true });
      doc.fontSize(12).text(`Registration: ${pack.registration}`);
      doc.text(`Model: ${pack.model} | S/N: ${pack.serial_number}`);
      doc.text(`Airframe Hours at Release: ${pack.release_hours}`);

      // Maintenance Summary
      doc.moveDown().fontSize(14).text('Work Performed', { underline: true });
      if (tasks.length === 0) {
        doc.fontSize(10).text('No tasks recorded.');
      } else {
        tasks.forEach((t, i) => {
          doc.moveDown(0.5).fontSize(10).text(`${i+1}. ${t.title}`);
          const signDate = t.signed_date ? new Date(t.signed_date).toLocaleString() : 'N/A';
          doc.fontSize(8).fillColor('gray').text(`Final QA by: ${t.actor_id} on ${signDate}`).fillColor('black');
        });
      }

      // Legal Statement (The "Sacred" Clause)
      doc.moveDown(2);
      const currentY = doc.y;
      doc.rect(50, currentY, 500, 70).stroke();
      doc.fontSize(10).text(
        'Certifies that the work specified, except as otherwise specified, was carried out in accordance with the regulation and in respect to that work the aircraft is considered ready for release to service.',
        60, currentY + 15, { width: 480, align: 'justify' }
      );

      doc.end();
    });
  }
}