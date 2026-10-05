const FAA_SOURCE_MANUFACTURER_CODES = new Map<string, string>([
  ['CESSNAAIRCRAFTCOMPANY', 'CESSNA'],
]);

export function normalizeFaaSourceManufacturerName(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

export function resolveFaaSourceManufacturerCode(value: unknown) {
  const normalizedSourceName = normalizeFaaSourceManufacturerName(value);
  return FAA_SOURCE_MANUFACTURER_CODES.get(normalizedSourceName) || null;
}
