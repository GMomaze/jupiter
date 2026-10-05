import { describe, expect, it } from 'vitest';
import { Manufacturer, ManufacturerSourceName } from './index.js';

describe('ManufacturerSourceName model contract', () => {
  it('preserves the existing Manufacturer contract and adds only the generic child association', () => {
    expect(Manufacturer.getTableName()).toEqual(
      expect.objectContaining({ tableName: 'manufacturers' })
    );
    expect(Manufacturer.options.timestamps).toBe(false);
    expect(Manufacturer.getAttributes()).toHaveProperty('name');
    expect(Manufacturer.getAttributes()).toHaveProperty('code');
    expect(Manufacturer.associations.SourceNames.target).toBe(ManufacturerSourceName);
    expect(ManufacturerSourceName.associations.Manufacturer.target).toBe(Manufacturer);
  });

  it('derives the normalized key and defaults active state', async () => {
    const record = ManufacturerSourceName.build({
      manufacturer_id: '3f8a898f-8ac0-493b-9640-54c7acb84cc7',
      source_type: 'FAA_AD',
      source_name: ' Example—Aircraft Company ',
    });

    await record.validate();

    expect(record.source_name).toBe('Example—Aircraft Company');
    expect(record.normalized_source_name).toBe('EXAMPLEAIRCRAFTCOMPANY');
    expect(record.is_active).toBe(true);
  });

  it('rejects unsupported source types and blank names', async () => {
    await expect(
      ManufacturerSourceName.build({
        manufacturer_id: '3f8a898f-8ac0-493b-9640-54c7acb84cc7',
        source_type: 'UNSUPPORTED',
        source_name: 'Example',
      }).validate()
    ).rejects.toThrow();

    await expect(
      ManufacturerSourceName.build({
        manufacturer_id: '3f8a898f-8ac0-493b-9640-54c7acb84cc7',
        source_type: 'FAA_AD',
        source_name: '   ',
      }).validate()
    ).rejects.toThrow();
  });

  it('contains no manufacturer-specific resolution constants', () => {
    const modelSource = ManufacturerSourceName.toString();
    expect(modelSource).not.toMatch(/CESSNA|BEECHCRAFT|PIPER|LYCOMING|HARTZELL/i);
  });
});
