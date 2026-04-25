import path from 'path';
import { promises as fs } from 'fs';

import type {
  ExternalServiceBulletin,
  VeryonImportOptions,
} from './types.js';

type ModelRecord = {
  id: string;
  model_name: string;
  Manufacturer?: {
    name?: string | null;
  } | null;
};

export class VeryonAdapter {
  // ✅ UPDATED: Added SE and simplified to catch SB, SEB, and SE
  private static readonly supportedPrefixes = ['SB', 'SEB', 'SE'];
  private static readonly defaultRoot = 'C:\\GMO\\Projects\\SB';

  // ✅ Track unmatched with manufacturer context
  static unmatchedModels: Array<{ model: string; manufacturer: string }> = [];

  private static sanitizePath(value: string | null | undefined) {
    return (value || '').trim().replace(/^"(.*)"$/, '$1');
  }

  private static normalize(value: string | null | undefined) {
    return (value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  private static digits(value: string | null | undefined) {
    return (value || '').replace(/[^0-9]/g, '');
  }

  private static mapCompliance(label: string) {
    const normalized = label.trim().toUpperCase();

    if (normalized === 'MANDATORY') return 'MANDATORY' as const;
    if (normalized === 'OPTIONAL') return 'OPTIONAL' as const;

    return 'MANUAL' as const;
  }

  private static parseDate(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parts = trimmed.split('/');
    if (parts.length !== 3) return null;

    const [month, day, year] = parts;
    if (!month || !day || !year) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  private static shouldImport(pubNo: string) {
    const normalized = pubNo.trim().toUpperCase();
    // ✅ Matches if the string starts with SB, SEB, or SE followed by anything alphanumeric
    return this.supportedPrefixes.some((prefix) =>
      normalized.startsWith(prefix)
    );
  }

  private static scoreModelMatch(
    manufacturerFolder: string,
    fileStem: string,
    model: ModelRecord
  ) {
    const manufacturer = this.normalize(model.Manufacturer?.name);
    const folder = this.normalize(manufacturerFolder);

    const manufacturerRelated =
      !manufacturer ||
      !folder ||
      manufacturer === folder ||
      manufacturer.includes(folder) ||
      folder.includes(manufacturer);

    const stem = this.normalize(fileStem);
    const modelName = this.normalize(model.model_name);
    const modelDigits = this.digits(model.model_name);
    const stemDigits = this.digits(fileStem);

    if (!stem || !modelName) return -1;

    if (modelName === stem || `${manufacturer}${stem}` === modelName) {
      return manufacturerRelated ? 100 : 95;
    }

    if (modelName.includes(stem) || stem.includes(modelName)) {
      return manufacturerRelated ? 85 : 75;
    }

    if (
      modelDigits &&
      stemDigits &&
      (modelDigits.startsWith(stemDigits) ||
        stemDigits.startsWith(modelDigits))
    ) {
      return manufacturerRelated ? 70 : 55;
    }

    return -1;
  }

  private static findModelForFile(
    manufacturerFolder: string,
    fileStem: string,
    models: ModelRecord[]
  ) {
    const ranked = models
      .map((model) => ({
        model,
        score: this.scoreModelMatch(
          manufacturerFolder,
          fileStem,
          model
        ),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.model || null;
  }

  private static async getCsvFiles(rootPath: string): Promise<string[]> {
    const stats = await fs.stat(rootPath);

    if (stats.isFile()) {
      return rootPath.toLowerCase().endsWith('.csv') ? [rootPath] : [];
    }

    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.getCsvFiles(fullPath)));
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private static parseCsvLine(line: string) {
    const columns = line.split(',');
    const pubNo = (columns[0] || '').trim();
    const pubName = (columns[1] || '').trim();
    const issuedOn = this.parseDate(columns[2] || '');
    const complianceLabel = (columns[4] || columns[3] || '').trim();
    const ata = columns.length > 5 ? (columns[3] || '').trim() : '';
    const titleDescription =
      columns.length > 5
        ? columns.slice(5).join(',').replace(/,+$/, '').trim()
        : (columns[4] || '').replace(/,+$/, '').trim();

    return {
      pubNo,
      pubName,
      issuedOn,
      ata,
      complianceLabel,
      titleDescription,
    };
  }

  static async buildForModels(
    models: ModelRecord[],
    options: VeryonImportOptions = {}
  ): Promise<ExternalServiceBulletin[]> {
    this.unmatchedModels = [];

    const rootPath = this.sanitizePath(options.rootPath);
    console.log(`[GMO VeryonAdapter] Starting import from: ${rootPath}`);

    try {
      await fs.access(rootPath);
    } catch {
      console.warn(`[VeryonAdapter] Path not accessible: ${rootPath}`);
      return [];
    }

    const files = await this.getCsvFiles(rootPath);
    const bulletins: ExternalServiceBulletin[] = [];

    for (const filePath of files) {
      const parentPath = path.dirname(filePath);
      const rawFolder = path.basename(parentPath);
      const fileStem = path.basename(filePath, path.extname(filePath));

      const isUploadFolder =
        rawFolder.toLowerCase() === 'service-bulletin-imports' ||
        rawFolder.toLowerCase() === 'uploads';

      const manufacturerFolder = isUploadFolder ? '' : rawFolder;

      let matchedModel = this.findModelForFile(
        manufacturerFolder,
        fileStem,
        models
      );

      if (!matchedModel) {
        matchedModel = this.findModelForFile('', fileStem, models);
      }

      if (!matchedModel) {
        this.unmatchedModels.push({
          model: fileStem,
          manufacturer: manufacturerFolder || 'Unknown',
        });
        continue;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines.slice(1)) {
        const parsed = this.parseCsvLine(line);

        if (!parsed.pubNo || !this.shouldImport(parsed.pubNo)) {
          continue;
        }

        bulletins.push({
          source: 'VERYON',
          source_primary: 'VERYON',
          source_refs: [
            {
              provider: 'VERYON',
              reference: parsed.pubNo,
              metadata: {
                file: filePath,
                manufacturer_folder: manufacturerFolder,
                file_stem: fileStem,
                pub_name: parsed.pubName,
                ata: parsed.ata || null,
                compliance_label: parsed.complianceLabel || null,
              },
            },
          ],
          sb_number: parsed.pubNo,
          title: parsed.pubName || parsed.titleDescription || parsed.pubNo,
          model_id: matchedModel.id,
          compliance_type: this.mapCompliance(parsed.complianceLabel),
          revision: null,
          document_url: null,
          description:
            parsed.titleDescription &&
            parsed.titleDescription !== parsed.pubName
              ? parsed.titleDescription
              : parsed.pubName || null,
          issued_on: parsed.issuedOn,
        });
      }
    }

    return bulletins;
  }
}