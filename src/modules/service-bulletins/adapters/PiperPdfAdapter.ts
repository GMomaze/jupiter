import { inflateSync } from 'zlib';
import { promises as fs } from 'fs';

import type {
  ExternalServiceBulletin,
  PiperPdfImportOptions,
} from './types.js';

type ModelRecord = {
  id: string;
  model_name: string;
  Manufacturer?: {
    name?: string | null;
  } | null;
};

type ParsedBulletin = {
  sbNumber: string;
  title: string;
  issuedOn: string | null;
  modelLines: string[];
};

export class PiperPdfAdapter {
  private static readonly defaultPdfPath =
    'C:\\GMO\\Projects\\Documents\\Piper SB-Index-12.pdf';

  private static normalize(value: string | null | undefined) {
    return (value || '')
      .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private static extractModelCode(modelName: string) {
    const match = modelName.toUpperCase().match(/PA-[A-Z0-9-]+/);
    return match?.[0] || null;
  }

  private static decodePdfString(value: Buffer) {
    const chars: string[] = [];

    for (let index = 0; index < value.length; index += 1) {
      const current = value[index];

      if (current === 0x5c) {
        index += 1;

        if (index >= value.length) {
          break;
        }

        const escaped = value[index];

        if (escaped === undefined) {
          break;
        }

        if (escaped === 0x6e) chars.push('\n');
        else if (escaped === 0x72) chars.push('\r');
        else if (escaped === 0x74) chars.push('\t');
        else if (escaped === 0x62) chars.push('\b');
        else if (escaped === 0x66) chars.push('\f');
        else if (escaped === 0x28) chars.push('(');
        else if (escaped === 0x29) chars.push(')');
        else if (escaped === 0x5c) chars.push('\\');
        else if (escaped >= 0x30 && escaped <= 0x37) {
          let octal = String.fromCharCode(escaped);

          while (
            octal.length < 3 &&
            index + 1 < value.length &&
            (value[index + 1] ?? -1) >= 0x30 &&
            (value[index + 1] ?? -1) <= 0x37
          ) {
            index += 1;
            octal += String.fromCharCode(value[index] ?? 0);
          }

          chars.push(String.fromCharCode(Number.parseInt(octal, 8)));
        } else {
          chars.push(String.fromCharCode(escaped));
        }

        continue;
      }

      chars.push(String.fromCharCode(current ?? 0));
    }

    return chars.join('');
  }

  private static extractTextTokens(content: Buffer) {
    const tokens: string[] = [];
    const pattern = /\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ/gs;
    const contentText = content.toString('latin1');

    for (const match of contentText.matchAll(pattern)) {
      if (match[1]) {
        tokens.push(this.decodePdfString(Buffer.from(match[1], 'latin1')));
        continue;
      }

      if (!match[2]) continue;
      const joined = [...match[2].matchAll(/\((.*?)\)/gs)]
        .map((segment) => {
          if (!segment[1]) return '';
          return this.decodePdfString(Buffer.from(segment[1], 'latin1'));
        })
        .join('');

      if (joined) {
        tokens.push(joined);
      }
    }

    return tokens;
  }

  private static async extractPdfText(pdfPath: string) {
    const bytes = await fs.readFile(pdfPath);
    const textBlocks: string[] = [];
    const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    const pdfText = bytes.toString('latin1');

    for (const match of pdfText.matchAll(streamPattern)) {
      try {
        if (!match[1]) continue;
        const inflated = inflateSync(Buffer.from(match[1], 'latin1'));
        const tokens = this.extractTextTokens(inflated);

        if (tokens.length > 0) {
          textBlocks.push(tokens.join('\n'));
        }
      } catch {
        // Ignore non-deflated or unsupported streams.
      }
    }

    return textBlocks.join('\n');
  }

  private static parseDate(value: string) {
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

    if (!match) {
      return null;
    }

    const [, month, day, rawYear] = match;
    if (!month || !day || !rawYear) return null;
    const year =
      rawYear.length === 2 ? `20${rawYear.padStart(2, '0')}` : rawYear;

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  private static parseBulletins(rawText: string): ParsedBulletin[] {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const bulletins: ParsedBulletin[] = [];
    let current: ParsedBulletin | null = null;
    let titleParts: string[] = [];

    for (const line of lines) {
      if (/^\d{3,4}[A-Z]?$/.test(line)) {
        if (current) {
          current.title = titleParts.join(' ').trim() || current.sbNumber;
          bulletins.push(current);
        }

        current = {
          sbNumber: line,
          title: line,
          issuedOn: null,
          modelLines: [],
        };
        titleParts = [];
        continue;
      }

      if (!current) {
        continue;
      }

      if (/^PA-[A-Z0-9-\/ ]+$/i.test(line)) {
        current.modelLines.push(line);
        continue;
      }

      const parsedDate = this.parseDate(line);
      if (parsedDate && !current.issuedOn) {
        current.issuedOn = parsedDate;
        continue;
      }

      if (
        !current.issuedOn &&
        !/^(SB|SL)\d+/i.test(line) &&
        !/^\*{1,2}$/.test(line)
      ) {
        titleParts.push(line);
      }
    }

    if (current) {
      current.title = titleParts.join(' ').trim() || current.sbNumber;
      bulletins.push(current);
    }

    return bulletins.filter(
      (bulletin) =>
        bulletin.sbNumber &&
        bulletin.title &&
        bulletin.modelLines.length > 0
    );
  }

  private static matchesModel(model: ModelRecord, modelLine: string) {
    const modelCode = this.extractModelCode(model.model_name);
    const normalizedLine = this.normalize(modelLine);
    const normalizedModelName = this.normalize(model.model_name);

    if (!modelCode) {
      return normalizedLine.includes(normalizedModelName);
    }

    const normalizedCode = this.normalize(modelCode);
    return (
      normalizedLine.includes(normalizedCode) ||
      normalizedLine.includes(normalizedModelName) ||
      normalizedModelName.includes(normalizedLine)
    );
  }

  static async buildForModels(
    models: ModelRecord[],
    options: PiperPdfImportOptions = {}
  ): Promise<ExternalServiceBulletin[]> {
    const pdfPath = options.pdfPath?.trim() || this.defaultPdfPath;

    try {
      await fs.access(pdfPath);
    } catch {
      return [];
    }

    const piperModels = models.filter(
      (model) => this.normalize(model.Manufacturer?.name) === 'PIPER'
    );

    if (piperModels.length === 0) {
      return [];
    }

    const extractedText = await this.extractPdfText(pdfPath);
    const parsedBulletins = this.parseBulletins(extractedText);
    const results: ExternalServiceBulletin[] = [];
    const seen = new Set<string>();

    for (const bulletin of parsedBulletins) {
      for (const model of piperModels) {
        const matched = bulletin.modelLines.some((line) =>
          this.matchesModel(model, line)
        );

        if (!matched) {
          continue;
        }

        const key = `${model.id}:${bulletin.sbNumber}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        results.push({
          source: 'PIPER_PDF',
          source_primary: 'PIPER_PDF',
          source_refs: [
            {
              provider: 'PIPER_PDF',
              reference: bulletin.sbNumber,
              metadata: {
                pdf_path: pdfPath,
                model_lines: bulletin.modelLines,
              },
            },
          ],
          sb_number: bulletin.sbNumber,
          title: bulletin.title,
          model_id: model.id,
          compliance_type: 'MANUAL',
          revision: null,
          document_url: pdfPath,
          description: `Imported from Piper PDF index: ${pdfPath}`,
          issued_on: bulletin.issuedOn,
        });
      }
    }

    return results;
  }
}
