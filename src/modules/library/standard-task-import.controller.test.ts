import { describe, expect, it, vi } from 'vitest';
import {
  detectStandardTaskCsvHeaders,
  previewMappedStandardTaskCsv,
  StandardTaskImportController,
} from './standard-task-import.controller.js';

describe('StandardTaskImportController preview parser', () => {
  it('detects headers and previews mapped rows while ignoring empty rows', () => {
    const csv = Buffer.from(
      [
        'title,description,source_type,interval_hours,interval_months,model_applicability,aircraft_applicability,is_active,unexpected_flag',
        '50 Hour Check,Inspect engine bay,MANUAL,50,6,C172,ZS-ABC,yes,extra',
        ',Missing title,MANUAL,12,2,,,true,',
        '   ,   ,   ,   ,   ,   ,   ,   ,   ',
        'Corrosion Scan,Inspect lower fuselage,SB,abc,4,C182,,maybe,',
      ].join('\n')
    );

    const detected = detectStandardTaskCsvHeaders(csv);
    const preview = previewMappedStandardTaskCsv(csv, {
      title: 'title',
      description: 'description',
      source_type: 'source_type',
      interval_hours: 'interval_hours',
      interval_months: 'interval_months',
      model_applicability: 'model_applicability',
      aircraft_applicability: 'aircraft_applicability',
      is_active: 'is_active',
    });

    expect(detected.headers).toContain('title');
    expect(detected.unknownColumns).toEqual(['unexpected_flag']);
    expect(preview.totalRows).toBe(3);
    expect(preview.validRowCount).toBe(1);
    expect(preview.invalidRowCount).toBe(2);
    expect(preview.unknownColumns).toEqual(['unexpected_flag']);

    expect(preview.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'VALID',
      values: {
        title: '50 Hour Check',
        description: 'Inspect engine bay',
        source_type: 'MANUAL',
        interval_hours: 50,
        interval_months: 6,
        model_applicability: 'C172',
        aircraft_applicability: 'ZS-ABC',
        is_active: true,
      },
      errors: [],
    });

    expect(preview.rows[1]).toMatchObject({
      rowNumber: 3,
      status: 'INVALID',
    });
    expect(preview.rows[1].errors).toContain('title is required.');

    expect(preview.rows[2]).toMatchObject({
      rowNumber: 5,
      status: 'INVALID',
    });
    expect(preview.rows[2].errors).toContain(
      'interval_hours must be numeric if provided.'
    );
    expect(preview.rows[2].errors).toContain(
      'is_active must resolve to boolean if provided.'
    );
  });

  it('blocks duplicate column mappings and required mapping gaps', () => {
    const csv = Buffer.from(
      [
        'task_name,details,kind',
        'Engine Check,Inspect engine,MANUAL',
      ].join('\n')
    );

    const duplicatePreview = previewMappedStandardTaskCsv(csv, {
      title: 'task_name',
      description: 'task_name',
      source_type: 'kind',
    });

    expect(duplicatePreview.invalidRowCount).toBe(1);
    expect(duplicatePreview.rows[0].errors).toContain(
      'CSV column "task_name" cannot be mapped to both title and description.'
    );

    const missingRequiredPreview = previewMappedStandardTaskCsv(csv, {
      title: 'task_name',
      description: '',
      source_type: 'kind',
    });

    expect(missingRequiredPreview.invalidRowCount).toBe(1);
    expect(missingRequiredPreview.rows[0].errors).toContain(
      'description must be mapped before preview.'
    );
  });

  it('renders import, mapping, and preview pages without writing to the database', () => {
    const render = vi.fn();
    const importRes = {
      render,
      locals: {},
    } as any;

    StandardTaskImportController.renderImportForm({} as any, importRes);

    expect(render).toHaveBeenCalledWith('library/tasks/import', {
      title: 'Standard Task Import Preview',
    });

    render.mockClear();

    const mapRes = {
      render,
      locals: {},
      status: vi.fn().mockReturnThis(),
    } as any;

    StandardTaskImportController.renderMappingPage(
      {
        file: {
          originalname: 'tasks.csv',
          buffer: Buffer.from(
            'task_name,details,kind\nEngine Check,Inspect engine,MANUAL\n'
          ),
        },
      } as any,
      mapRes
    );

    expect(mapRes.status).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith(
      'library/tasks/map-columns',
      expect.objectContaining({
        title: 'Map Standard Task Columns',
        fileName: 'tasks.csv',
        headers: ['task_name', 'details', 'kind'],
      })
    );

    render.mockClear();

    const previewRes = {
      render,
      locals: {},
      status: vi.fn().mockReturnThis(),
    } as any;

    StandardTaskImportController.previewImport(
      {
        body: {
          csv_payload: Buffer.from(
            'task_name,details,kind\nEngine Check,Inspect engine,MANUAL\n'
          ).toString('base64'),
          file_name: 'tasks.csv',
          title: 'task_name',
          description: 'details',
          source_type: 'kind',
        },
      } as any,
      previewRes
    );

    expect(previewRes.status).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledWith(
      'library/tasks/preview',
      expect.objectContaining({
        title: 'Standard Task Import Preview',
        fileName: 'tasks.csv',
        preview: expect.objectContaining({
          totalRows: 1,
          validRowCount: 1,
          invalidRowCount: 0,
          mapping: expect.objectContaining({
            title: 'task_name',
            description: 'details',
            source_type: 'kind',
          }),
        }),
      })
    );
  });
});
