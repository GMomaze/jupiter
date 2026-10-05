import { describe, expect, it } from 'vitest';
import { normalizeManufacturerSourceName } from './manufacturer-source-name-normalization.js';

describe('manufacturer source-name normalization', () => {
  it('normalizes case, spacing, punctuation, and supported dash variants deterministically', () => {
    const variants = [
      ' Cessna Aircraft Company ',
      'CESSNA AIRCRAFT COMPANY',
      'Cessna-Aircraft Company',
      'Cessna—Aircraft Company',
    ];

    expect(variants.map(normalizeManufacturerSourceName)).toEqual([
      'CESSNAAIRCRAFTCOMPANY',
      'CESSNAAIRCRAFTCOMPANY',
      'CESSNAAIRCRAFTCOMPANY',
      'CESSNAAIRCRAFTCOMPANY',
    ]);
  });

  it('does not remove corporate suffixes or perform fuzzy manufacturer transformations', () => {
    expect(normalizeManufacturerSourceName('Example Aircraft Company')).toBe(
      'EXAMPLEAIRCRAFTCOMPANY'
    );
    expect(normalizeManufacturerSourceName('Example Aircraft')).toBe('EXAMPLEAIRCRAFT');
    expect(normalizeManufacturerSourceName('Example')).toBe('EXAMPLE');
  });

  it('returns an empty key for blank input', () => {
    expect(normalizeManufacturerSourceName('   ')).toBe('');
    expect(normalizeManufacturerSourceName(null)).toBe('');
  });
});
