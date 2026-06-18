import { describe, expect, it } from 'vitest';
import { LibraryService } from './library.service.js';

describe('LibraryService serialized component life-limit due status', () => {
  it('uses unified NOT_DUE state for life limits outside threshold', () => {
    const result = LibraryService.evaluateSerializedComponentLifeLimits(
      [
        {
          id: 'limit-hours',
          limit_type: 'TSN retirement',
          basis: 'SINCE_NEW',
          limit_hours: 100,
          limit_cycles: null,
          limit_months: null,
          is_active: true,
        },
      ],
      {
        tsn_hours: 50,
        tso_hours: null,
        csn_cycles: null,
        cso_cycles: null,
      },
      '2026-06-18'
    );

    expect(result.state).toBe('NOT_DUE');
    expect(result.worstLimit?.status).toBe('NOT_DUE');
  });

  it('keeps most restrictive mixed life-limit behavior', () => {
    const result = LibraryService.evaluateSerializedComponentLifeLimits(
      [
        {
          id: 'limit-hours',
          limit_type: 'TSN retirement',
          basis: 'SINCE_NEW',
          limit_hours: 200,
          limit_cycles: null,
          limit_months: null,
          is_active: true,
        },
        {
          id: 'limit-cycles',
          limit_type: 'CSN retirement',
          basis: 'SINCE_NEW',
          limit_hours: null,
          limit_cycles: 100,
          limit_months: null,
          is_active: true,
        },
      ],
      {
        tsn_hours: 50,
        tso_hours: null,
        csn_cycles: 100,
        cso_cycles: null,
      },
      '2026-06-18'
    );

    expect(result.state).toBe('DUE');
    expect(result.worstLimit?.id).toBe('limit-cycles');
  });
});
