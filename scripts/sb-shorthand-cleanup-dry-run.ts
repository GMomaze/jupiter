import fs from 'node:fs';
import path from 'node:path';

import { sequelize } from '../src/models/index.js';

type CandidateRow = {
  service_bulletin_model_id: string;
  allocation_id: string;
  service_bulletin_id: string;
  sb_reference: string;
  sb_title: string | null;
  raw_models_affected_text: string;
  parsed_token: string | null;
  expanded_token: string;
  linked_model_code: string | null;
  linked_model_name: string | null;
  allocation_status: string;
  allocation_classification: string;
};

type ClassifiedRow = CandidateRow & {
  has_procedure_words: boolean;
  has_date: boolean;
  has_ad_like_number: boolean;
  has_part_kit_like_value: boolean;
  not_safely_inferable: boolean;
  recommended_action: 'SAFE_KEEP' | 'MANUAL_REVIEW' | 'SAFE_REMOVE_CANDIDATE';
};

function normalize(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function compact(value: unknown) {
  return normalize(value).replace(/\s+/g, '');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rawHasExactToken(raw: string, token: string) {
  const rawText = normalize(raw);
  const tokenPattern = escapeRegex(normalize(token));
  return new RegExp(`(^|[^A-Z0-9])${tokenPattern}([^A-Z0-9]|$)`).test(rawText);
}

function isApprovedSafeInference(raw: string, token: string) {
  const rawText = compact(raw);
  const tokenText = compact(token);

  if (!rawText || !tokenText) return false;
  if (rawHasExactToken(raw, token)) return true;

  const suffixMatch = tokenText.match(/^(PA-[A-Z0-9]+-)([0-9A-Z]+)$/);
  if (suffixMatch) {
    const base = suffixMatch[1] || '';
    const suffix = suffixMatch[2] || '';
    if (rawText.includes(`${base}${suffix}`)) return true;
    if (rawText.includes(base) && (rawText.includes(`/-${suffix}`) || rawText.includes(`/${suffix}`))) {
      return true;
    }
  }

  const mixedFamilyMatch = tokenText.match(/^PA-([A-Z]?)([0-9]+)-([0-9A-Z]+)$/);
  if (mixedFamilyMatch) {
    const letter = mixedFamilyMatch[1] || '';
    const family = mixedFamilyMatch[2] || '';
    const suffix = mixedFamilyMatch[3] || '';
    if (rawText.includes(`/${letter}${family}-${suffix}`)) return true;
    if (rawText.includes(`,${letter}${family}-${suffix}`)) return true;
    if (letter && rawText.includes(`${letter}${family}-${suffix}`)) return true;
  }

  const commaFamilyMatch = tokenText.match(/^PA-([0-9]+)([A-Z]?)$/);
  if (commaFamilyMatch) {
    const family = commaFamilyMatch[1] || '';
    const suffixLetter = commaFamilyMatch[2] || '';
    if (suffixLetter && rawText.includes(`PA-${family}`) && rawText.includes(`,${family}${suffixLetter}`)) {
      return true;
    }
    if (!suffixLetter && rawText.includes(`PA-${family}`)) return true;
  }

  return new RegExp(`(^|/)${escapeRegex(tokenText)}(/|$)`).test(rawText);
}

function classify(row: CandidateRow): ClassifiedRow {
  const rawText = row.raw_models_affected_text || '';
  const flags = {
    has_procedure_words: /\b(?:Inspection|Replacement|Modification|Assembly|Assy|Operation|Instructions|Repair|Placard)\b/i.test(rawText),
    has_date: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(rawText),
    has_ad_like_number: /\b(?:AD\s*)?\d{4}-\d{2}-\d{2}\b/i.test(rawText) || /\b\d{2}-\d{2}-\d{2}\b/.test(rawText),
    has_part_kit_like_value: /\b\d{3,}[- ]\d{2,}[A-Z0-9-]*\b/i.test(rawText) || /\b[A-Z]?\d{2,}[A-Z]?\d{2,}\b/i.test(rawText),
    not_safely_inferable: !isApprovedSafeInference(rawText, row.expanded_token),
  };
  const dirty =
    flags.has_procedure_words ||
    flags.has_date ||
    flags.has_ad_like_number ||
    flags.has_part_kit_like_value;
  const manualStatus = ['LINKED_MANUALLY', 'MODEL_CREATED_INCOMPLETE', 'IGNORED'].includes(
    row.allocation_status
  );
  let recommendedAction: ClassifiedRow['recommended_action'] = 'MANUAL_REVIEW';

  if (!flags.not_safely_inferable && !dirty) {
    recommendedAction = 'SAFE_KEEP';
  } else if (manualStatus) {
    recommendedAction = 'MANUAL_REVIEW';
  } else if (flags.not_safely_inferable && dirty) {
    recommendedAction = 'SAFE_REMOVE_CANDIDATE';
  }

  return {
    ...row,
    ...flags,
    recommended_action: recommendedAction,
  };
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function queryExpansionLinkedRows() {
  const rows = await sequelize.query<CandidateRow>(
    `
    SELECT
      sbm.id::text AS service_bulletin_model_id,
      a.id::text AS allocation_id,
      a.service_bulletin_id::text AS service_bulletin_id,
      sb.reference AS sb_reference,
      sb.title AS sb_title,
      a.raw_models_affected_text,
      a.parsed_token,
      token.value AS expanded_token,
      cm.model_code AS linked_model_code,
      cm.model_name AS linked_model_name,
      a.status AS allocation_status,
      a.classification AS allocation_classification
    FROM sb_model_applicability_allocations a
    JOIN service_bulletins sb ON sb.id = a.service_bulletin_id
    JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.metadata->'safe_shorthand_expansion'->'expanded_tokens', '[]'::jsonb)
    ) token(value) ON true
    JOIN LATERAL (
      SELECT jm.value->>'id' AS model_id
      FROM jsonb_array_elements(
        COALESCE(a.metadata->'safe_shorthand_expansion'->'matched_models', '[]'::jsonb)
      ) jm(value)
      WHERE jm.value->>'token' = token.value
      LIMIT 1
    ) matched ON true
    JOIN component_models cm ON cm.id::text = matched.model_id
    JOIN service_bulletin_models sbm
      ON sbm.service_bulletin_id = a.service_bulletin_id
     AND sbm.model_id::text = matched.model_id
    WHERE a.metadata ? 'safe_shorthand_expansion'
    ORDER BY sb.reference, a.id, token.value
    `,
    { type: 'SELECT' }
  );

  return rows;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const reportMode = execute ? 'execute' : 'dry-run';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.resolve(
    'reports',
    `sb-shorthand-cleanup-${reportMode}-${timestamp}.csv`
  );
  const rows = (await queryExpansionLinkedRows()).map(classify);
  const dryRunRows = rows.filter((row) => row.recommended_action === 'SAFE_REMOVE_CANDIDATE');
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.recommended_action] = (acc[row.recommended_action] || 0) + 1;
    return acc;
  }, {});
  const exactManualIncompleteIncluded = dryRunRows.filter(
    (row) =>
      row.allocation_classification !== 'SHORTHAND_GROUP' ||
      ['LINKED_MANUALLY', 'MODEL_CREATED_INCOMPLETE'].includes(row.allocation_status)
  ).length;

  if (execute && dryRunRows.length !== 0 && dryRunRows.length !== 4) {
    throw new Error(
      `Refusing cleanup: expected exactly 4 SAFE_REMOVE_CANDIDATE rows for first execution or 0 for idempotent re-run, found ${dryRunRows.length}.`
    );
  }

  if (execute && exactManualIncompleteIncluded > 0) {
    throw new Error(
      `Refusing cleanup: ${exactManualIncompleteIncluded} exact/manual/incomplete rows were included.`
    );
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const columns: Array<keyof ClassifiedRow> = [
    'service_bulletin_model_id',
    'allocation_id',
    'service_bulletin_id',
    'sb_reference',
    'sb_title',
    'raw_models_affected_text',
    'parsed_token',
    'expanded_token',
    'linked_model_code',
    'linked_model_name',
    'allocation_status',
    'has_procedure_words',
    'has_date',
    'has_ad_like_number',
    'has_part_kit_like_value',
    'not_safely_inferable',
    'recommended_action',
  ];
  const csv = [columns.join(',')]
    .concat(dryRunRows.map((row) => columns.map((column) => csvCell(row[column])).join(',')))
    .join('\n');

  fs.writeFileSync(outputPath, csv, 'utf8');

  let deletedRows = 0;

  if (execute) {
    await sequelize.transaction(async (transaction) => {
      for (const row of dryRunRows) {
        const deleted = await sequelize.query<{ id: string }>(
          `
          DELETE FROM service_bulletin_models
          WHERE id = :serviceBulletinModelId
          RETURNING id::text AS id
          `,
          {
            replacements: {
              serviceBulletinModelId: row.service_bulletin_model_id,
            },
            transaction,
            type: 'SELECT',
          }
        );
        deletedRows += deleted.length;
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        dry_run: !execute,
        execute,
        db_mutation: execute,
        output_path: outputPath,
        counts: {
          all_expansion_linked_rows: rows.length,
          by_recommended_action: counts,
          safe_remove_candidate_rows: dryRunRows.length,
          exact_manual_incomplete_included: exactManualIncompleteIncluded,
          deleted_service_bulletin_model_rows: deletedRows,
        },
        sample_candidates: dryRunRows.slice(0, 10).map((row) => ({
          service_bulletin_model_id: row.service_bulletin_model_id,
          allocation_id: row.allocation_id,
          service_bulletin_id: row.service_bulletin_id,
          sb_reference: row.sb_reference,
          sb_title: row.sb_title,
          raw_models_affected_text: row.raw_models_affected_text,
          parsed_token: row.parsed_token,
          expanded_token: row.expanded_token,
          linked_model_code: row.linked_model_code,
          linked_model_name: row.linked_model_name,
          allocation_status: row.allocation_status,
          has_procedure_words: row.has_procedure_words,
          has_date: row.has_date,
          has_ad_like_number: row.has_ad_like_number,
          has_part_kit_like_value: row.has_part_kit_like_value,
          not_safely_inferable: row.not_safely_inferable,
        })),
      },
      null,
      2
    )
  );
}

main().finally(async () => {
  await sequelize.close();
});
