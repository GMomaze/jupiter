import { describe, expect, it } from 'vitest';

import { previewSbImportFile } from './sb-import.adapters.js';

function csvBuffer(value: string) {
  return Buffer.from(value, 'utf8');
}

describe('SB import adapters', () => {
  it('normalizes Piper SB and SL rows with publication metadata', () => {
    const preview = previewSbImportFile(
      csvBuffer(
        [
          'publication_type,reference,title,issue_date,status,classification,ata_code,ad_references,part_kit_references,piper_family,piper_series,superseded_by',
          'SB,SB 1005,Drain holes,2024-01-15,Active,Mandatory,71,AD 2020-01-01,Kit 123,PA-28,Cherokee,',
          'SL,SL 2001,Inspection letter,2023-03-01,Superseded by SB 1005,Recommended,53,AD 2021-02-02,Part ABC,PA-32,Saratoga,SB 1005',
        ].join('\n')
      ),
      'piper-index.csv',
      'PIPER'
    );

    expect(preview.adapterUsed).toBe('PIPER');
    expect(preview.validRowCount).toBe(2);

    const [sbRow, slRow] = preview.rows;

    expect(sbRow?.values).toMatchObject({
      manufacturer: 'Piper',
      reference: 'SB 1005',
      title: 'Drain holes',
      issue_date: '2024-01-15',
      status: 'ACTIVE',
      category: 'SB',
      compliance_requirement: 'MANDATORY',
      source_format: 'PIPER_SB_SL_INDEX',
      is_active: true,
    });
    expect(sbRow?.values.piper_metadata).toMatchObject({
      publication_type: 'SB',
      publication_status: 'ACTIVE',
      classification: 'MANDATORY',
      ata_code: '71',
      ad_references: ['AD 2020-01-01'],
      part_kit_references: ['Kit 123'],
      piper_family: 'PA-28',
      piper_series: 'Cherokee',
      source_row: 2,
    });
    expect(sbRow?.values.raw_source_text).toContain('publication_type: SB');

    expect(slRow?.values).toMatchObject({
      reference: 'SL 2001',
      status: 'SUPERSEDED',
      category: 'SL',
      compliance_requirement: 'MANUAL',
      is_active: false,
    });
    expect(slRow?.values.piper_metadata).toMatchObject({
      publication_type: 'SL',
      publication_status: 'SUPERSEDED',
      classification: 'RECOMMENDED',
      superseded_by_reference: 'SB 1005',
      source_row: 3,
    });
  });

  it('marks inactive Piper publication statuses as inactive', () => {
    const preview = previewSbImportFile(
      csvBuffer(
        [
          'type,reference,title,date,status',
          'SB,SB 1,Obsolete row,2020-01-01,Obsolete',
          'SB,SB 2,Cancelled row,2020-01-01,Cancelled',
          'SL,SL 3,Not used row,2020-01-01,Not Used',
        ].join('\n')
      ),
      'piper-status.csv',
      'PIPER'
    );

    expect(preview.rows.map((row) => row.values.status)).toEqual([
      'OBSOLETE',
      'CANCELLED',
      'NOT_USED',
    ]);
    expect(preview.rows.map((row) => row.values.is_active)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('recognizes Piper Models Affected as applicability model text', () => {
    const preview = previewSbImportFile(
      csvBuffer(
        [
          'publication_type,reference,title,issue_date,status,classification,Models Affected',
          'SB,SB 3001,Model applicability row,2024-02-01,Active,Mandatory,PA-28-235',
        ].join('\n')
      ),
      'piper-models-affected.csv',
      'PIPER'
    );

    expect(preview.unknownColumns).not.toContain('Models Affected');
    expect(preview.rows[0]?.values.applicability_model).toBe('PA-28-235');
    expect(preview.rows[0]?.values.raw_source_text).toContain(
      'Models Affected: PA-28-235'
    );
  });

  it('preserves generic and Cessna adapter behavior', () => {
    const genericPreview = previewSbImportFile(
      csvBuffer('manufacturer,reference,title,date\nGeneric,GEN-1,Generic row,2024-01-01'),
      'generic.csv',
      'GENERIC'
    );

    expect(genericPreview.adapterUsed).toBe('GENERIC');
    expect(genericPreview.rows[0]?.values.piper_metadata).toBeUndefined();

    expect(() =>
      previewSbImportFile(csvBuffer('reference,title\nCES-1,Cessna row'), 'cessna.csv', 'CESSNA')
    ).toThrow('Cessna adapter is not implemented yet.');
  });
});
