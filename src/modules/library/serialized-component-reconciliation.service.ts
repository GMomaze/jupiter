import { formatModelDisplay } from '../../utils/model-display.js';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';
import type {
  LegacyReconciliationRow,
  SerializedComponentReconciliationRepository,
  SerializedInstallationReconciliationRow,
} from './serialized-component-reconciliation.repository.js';

export const SERIALIZED_RECONCILIATION_BUCKETS = [
  'MATCHED', 'LEGACY_ONLY', 'SERIALIZED_ONLY', 'MODEL_MISMATCH',
  'SERIAL_MISMATCH', 'POSITION_MISMATCH', 'INSTALLATION_CONFLICT',
  'LIFE_STATE_MISSING', 'UNMAPPED',
] as const;

type DetailRow = Record<string, any>;
type ReconciliationCounts = {
  legacyPositionCounts: Record<string, number>;
  serializedPositionCounts: Record<string, number>;
  legacySerialCounts: Record<string, number>;
  serializedSerialCounts: Record<string, number>;
};

export class SerializedComponentReconciliationService {
  constructor(private readonly repository: SerializedComponentReconciliationRepository) {}

  async getReport(authority: TenantQueryAuthority) {
    assertTenantQueryAuthority(authority);
    const data = await this.repository.load(authority);
    const activeLegacyRows = data.legacyRows.filter(row =>
      !row.legacy_removed_at && ['INSTALLED', 'QUARANTINED'].includes(normalize(row.legacy_status)),
    );
    const serializedRows = data.serializedInstallationRows;
    const serializedByAircraft = serializedRows.reduce<Record<string, SerializedInstallationReconciliationRow[]>>(
      (lookup, row) => {
        const key = normalize(row.aircraft_id);
        (lookup[key] ||= []).push(row);
        return lookup;
      },
      {},
    );
    const used = new Set<string>();
    const bucketCounts: Record<string, number> = Object.fromEntries(
      SERIALIZED_RECONCILIATION_BUCKETS.map(bucket => [bucket, 0]),
    );
    const details: DetailRow[] = [];
    const legacyPositionCounts = countKeys(activeLegacyRows.map(row => key(row.aircraft_id, row.legacy_position, row.legacy_asset_type_id)));
    const serializedPositionCounts = countKeys(serializedRows.map(row => key(row.aircraft_id, row.serialized_position, row.serialized_asset_type_id)));
    const legacySerialCounts = countKeys(activeLegacyRows.map(row => key(row.aircraft_id, row.legacy_serial_number)));
    const serializedSerialCounts = countKeys(serializedRows.map(row => key(row.aircraft_id, row.serialized_serial_number)));

    for (const legacy of activeLegacyRows) {
      const candidates = serializedByAircraft[normalize(legacy.aircraft_id)] || [];
      const match = findMatch(legacy, candidates, used);
      if (match?.row.serialized_installation_id) used.add(String(match.row.serialized_installation_id));
      const detail = buildDetail(legacy, match?.row || null, match?.basis || 'UNMAPPED', match?.confidence || 'NONE', {
        legacyPositionCounts, serializedPositionCounts, legacySerialCounts, serializedSerialCounts,
      });
      bucketCounts[detail.bucket] = (bucketCounts[detail.bucket] || 0) + 1;
      details.push(detail);
    }
    for (const serialized of serializedRows) {
      if (used.has(normalize(serialized.serialized_installation_id))) continue;
      const detail = buildDetail(null, serialized, 'SERIALIZED_ONLY', 'NONE', {
        legacyPositionCounts, serializedPositionCounts, legacySerialCounts, serializedSerialCounts,
      });
      bucketCounts[detail.bucket] = (bucketCounts[detail.bucket] || 0) + 1;
      details.push(detail);
    }

    const matchedCount = details.filter(row => row.legacy_component_id && row.serialized_component_id).length;
    const migrationReadyCount = details.filter(row => row.bucket === 'MATCHED').length;
    return {
      generated_at: new Date().toISOString(),
      summary: {
        total_legacy_rows: data.legacyRows.length,
        active_legacy_rows: activeLegacyRows.length,
        total_serialized_components: data.totalSerializedComponents,
        active_serialized_installations: serializedRows.length,
        matched_count: matchedCount,
        migration_ready_count: migrationReadyCount,
        readiness_percentage: details.length
          ? Number(((migrationReadyCount / details.length) * 100).toFixed(1))
          : 100,
      },
      bucket_counts: bucketCounts,
      details,
      detailed_exceptions: details.filter(row => row.bucket !== 'MATCHED'),
      explanation: 'Read-only reconciliation only. No mappings are persisted and no lifecycle, compliance, workpack, or SB records are changed.',
    };
  }
}

function findMatch(legacy: LegacyReconciliationRow, candidates: SerializedInstallationReconciliationRow[], used: Set<string>) {
  const available = candidates.filter(row => !row.serialized_installation_id || !used.has(normalize(row.serialized_installation_id)));
  const rows = available.length ? available : candidates;
  const serial = normalize(legacy.legacy_serial_number);
  const model = normalize(legacy.legacy_model_id);
  const position = normalize(legacy.legacy_position);
  const asset = normalize(legacy.legacy_asset_type_id);
  const definitions = [
    ['AIRCRAFT_SERIAL_MODEL', 'HIGH', (row: SerializedInstallationReconciliationRow) => serial && normalize(row.serialized_serial_number) === serial && model && normalize(row.serialized_model_id) === model],
    ['AIRCRAFT_SERIAL', 'MEDIUM', (row: SerializedInstallationReconciliationRow) => serial && normalize(row.serialized_serial_number) === serial],
    ['AIRCRAFT_POSITION_ASSET_MODEL', 'MEDIUM', (row: SerializedInstallationReconciliationRow) => position && normalize(row.serialized_position) === position && asset && normalize(row.serialized_asset_type_id) === asset && model && normalize(row.serialized_model_id) === model],
    ['AIRCRAFT_POSITION_ASSET', 'LOW', (row: SerializedInstallationReconciliationRow) => position && normalize(row.serialized_position) === position && asset && normalize(row.serialized_asset_type_id) === asset],
  ] as const;
  for (const [basis, confidence, predicate] of definitions) {
    const row = rows.find(item => Boolean(predicate(item)));
    if (row) return { basis, confidence, row };
  }
  return null;
}

function buildDetail(legacy: LegacyReconciliationRow | null, serialized: SerializedInstallationReconciliationRow | null, matchBasis: string, confidence: string, counts: ReconciliationCounts) {
  const flags: string[] = [];
  const legacyModel = normalize(legacy?.legacy_model_id);
  const serializedModel = normalize(serialized?.serialized_model_id);
  const legacySerial = normalize(legacy?.legacy_serial_number);
  const serializedSerial = normalize(serialized?.serialized_serial_number);
  const legacyPosition = normalize(legacy?.legacy_position);
  const serializedPosition = normalize(serialized?.serialized_position);
  if (legacy && serialized && legacyModel && serializedModel && legacyModel !== serializedModel) flags.push('MODEL_MISMATCH');
  if (legacy && serialized && legacySerial && serializedSerial && legacySerial !== serializedSerial) flags.push('SERIAL_MISMATCH');
  if (legacy && serialized && legacyPosition && serializedPosition && legacyPosition !== serializedPosition) flags.push('POSITION_MISMATCH');
  if ((counts.legacyPositionCounts[key(legacy?.aircraft_id, legacy?.legacy_position, legacy?.legacy_asset_type_id)] || 0) > 1) flags.push('LEGACY_POSITION_CONFLICT');
  if ((counts.serializedPositionCounts[key(serialized?.aircraft_id, serialized?.serialized_position, serialized?.serialized_asset_type_id)] || 0) > 1) flags.push('SERIALIZED_POSITION_CONFLICT');
  if ((counts.legacySerialCounts[key(legacy?.aircraft_id, legacy?.legacy_serial_number)] || 0) > 1) flags.push('LEGACY_SERIAL_DUPLICATE');
  if ((counts.serializedSerialCounts[key(serialized?.aircraft_id, serialized?.serialized_serial_number)] || 0) > 1) flags.push('SERIALIZED_SERIAL_DUPLICATE');
  if (serialized && !serialized.life_state_id) flags.push('LIFE_STATE_MISSING');
  const bucket = flags.some(flag => flag.includes('CONFLICT') || flag.includes('DUPLICATE'))
    ? 'INSTALLATION_CONFLICT'
    : !legacy && serialized ? 'SERIALIZED_ONLY'
    : legacy && !serialized ? (legacySerial || legacyPosition || legacyModel ? 'LEGACY_ONLY' : 'UNMAPPED')
    : flags.includes('MODEL_MISMATCH') ? 'MODEL_MISMATCH'
    : flags.includes('SERIAL_MISMATCH') ? 'SERIAL_MISMATCH'
    : flags.includes('POSITION_MISMATCH') ? 'POSITION_MISMATCH'
    : flags.includes('LIFE_STATE_MISSING') ? 'LIFE_STATE_MISSING'
    : 'MATCHED';
  return {
    aircraft_registration: normalize(legacy?.aircraft_registration || serialized?.aircraft_registration) || 'Unassigned',
    legacy_component_id: legacy?.legacy_component_id || null,
    serialized_component_id: serialized?.serialized_component_id || null,
    serialized_installation_id: serialized?.serialized_installation_id || null,
    legacy_model_id: legacy?.legacy_model_id || null,
    serialized_model_id: serialized?.serialized_model_id || null,
    legacy_model_display: display(legacy?.legacy_model_code, legacy?.legacy_model_name),
    serialized_model_display: display(serialized?.serialized_model_code, serialized?.serialized_model_name),
    legacy_asset_type_code: legacy?.legacy_asset_type_code || null,
    serialized_asset_type_code: serialized?.serialized_asset_type_code || null,
    legacy_serial_number: legacy?.legacy_serial_number || null,
    serialized_serial_number: serialized?.serialized_serial_number || null,
    legacy_position: legacy?.legacy_position || null,
    serialized_position: serialized?.serialized_position || null,
    bucket, confidence, match_basis: matchBasis, conflict_flags: flags,
  };
}

function normalize(value: unknown) { return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase(); }
function key(...parts: unknown[]) { const values = parts.map(normalize); return values.some(value => !value) ? '' : values.join('|'); }
function countKeys(keys: string[]) { return keys.reduce<Record<string, number>>((out, item) => { if (item) out[item] = (out[item] || 0) + 1; return out; }, {}); }
function display(code: unknown, name: unknown) { return formatModelDisplay({ model_code: code ? String(code) : null, model_name: name ? String(name) : null }); }
