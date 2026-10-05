export function normalizeManufacturerSourceName(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}
