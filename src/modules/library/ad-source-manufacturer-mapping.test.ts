import { describe, expect, it } from 'vitest';
import {
  normalizeFaaSourceManufacturerName,
  resolveFaaSourceManufacturerCode,
} from './ad-source-manufacturer-mapping.js';

describe('FAA AD source manufacturer mapping', () => {
  it('resolves only the approved normalized Cessna source name to CESSNA', () => {
    expect(normalizeFaaSourceManufacturerName(' Cessna  Aircraft Company ')).toBe(
      'CESSNAAIRCRAFTCOMPANY'
    );
    expect(resolveFaaSourceManufacturerCode(' Cessna  Aircraft Company ')).toBe('CESSNA');
  });

  it('does not use substring, starts-with, or invented aliases', () => {
    expect(resolveFaaSourceManufacturerCode('Cessna Aircraft')).toBeNull();
    expect(resolveFaaSourceManufacturerCode('Cessna Co')).toBeNull();
    expect(resolveFaaSourceManufacturerCode('Cessna Aircraft Corp')).toBeNull();
    expect(resolveFaaSourceManufacturerCode('Cessna Aircraft Company Division')).toBeNull();
  });
});
