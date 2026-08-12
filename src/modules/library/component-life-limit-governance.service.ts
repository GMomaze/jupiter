import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import sequelize from '../../config/database.js';

export type LifeLimitProposalInput = {
  component_model_id: string;
  determination: 'LIFE_LIMITED' | 'NOT_LIFE_LIMITED' | 'LIMIT_STATUS_UNKNOWN';
  applicability_scope: 'ALL_SERIALS_OF_MODEL';
  applicability_statement: string;
  narrower_effectivity_absent: true;
  limit_type?: 'TBO_HOURS' | 'TBO_CYCLES' | 'LIFE_LIMIT_HOURS' | 'LIFE_LIMIT_CYCLES' | 'CALENDAR_LIFE' | null;
  basis?: 'SINCE_OVERHAUL' | 'SINCE_NEW' | 'CALENDAR' | null;
  limit_hours?: number | null;
  limit_cycles?: number | null;
  limit_months?: number | null;
  source_reference: string;
  source_document_reference?: string | null;
  source_effective_date: string;
  evidence_summary: string;
  proposal_reason: string;
};

type ProposalRow = LifeLimitProposalInput & {
  id: string;
  lineage_id: string;
  revision_number: number;
  proposal_purpose: 'ESTABLISH' | 'REPLACEMENT' | 'WITHDRAWAL';
  target_proposal_id: string | null;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'SUPERSEDED';
  proposed_by: string;
  proposed_at: Date;
  decision_by: string | null;
  decision_at: Date | null;
  decision_reason: string | null;
  evidence_confirmed: boolean;
  created_at: Date;
  updated_at: Date;
};

type PublicationRow = {
  id: string;
  proposal_id: string;
  component_life_limit_id: string;
  publication_state: 'DORMANT' | 'ACTIVE' | 'WITHDRAWN' | 'SUPERSEDED';
};

const PROPOSE = 'COMPONENT_LIFE_LIMIT_PROPOSE';
const APPROVE = 'COMPONENT_LIFE_LIMIT_APPROVE';

export class ComponentLifeLimitGovernanceService {
  static async propose(actorId: string, input: LifeLimitProposalInput, suppliedTransaction?: Transaction) {
    this.validateProposalInput(input);
    const work = async (transaction: Transaction) => {
      await this.requirePermission(actorId, PROPOSE, transaction);
      const id = randomUUID();
      const lineageId = randomUUID();
      const [proposal] = await sequelize.query<ProposalRow>(
        `INSERT INTO public.component_life_limit_proposals (
          id, component_model_id, lineage_id, revision_number, proposal_purpose,
          determination, applicability_scope, applicability_statement,
          narrower_effectivity_absent, limit_type, basis, limit_hours, limit_cycles,
          limit_months, source_reference, source_document_reference,
          source_effective_date, evidence_summary, proposal_reason, proposed_by
        ) VALUES (
          :id, :component_model_id, :lineageId, 1, 'ESTABLISH', :determination,
          :applicability_scope, :applicability_statement, :narrower_effectivity_absent,
          :limit_type, :basis, :limit_hours, :limit_cycles, :limit_months,
          :source_reference, :source_document_reference, :source_effective_date,
          :evidence_summary, :proposal_reason, :actorId
        ) RETURNING *;`,
        { replacements: this.replacements({ ...input, id, lineageId, actorId }), type: QueryTypes.SELECT, transaction }
      );
      await this.history(transaction, proposal!, null, 'PROPOSAL_CREATED', actorId, input.proposal_reason, false, null, 'PROPOSED', {}, this.snapshot(proposal!));
      return proposal!;
    };
    if (suppliedTransaction) { await this.requireSerializable(suppliedTransaction); return work(suppliedTransaction); }
    return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, work);
  }

  static async proposeRevision(
    actorId: string,
    targetProposalId: string,
    purpose: 'REPLACEMENT' | 'WITHDRAWAL',
    input: LifeLimitProposalInput,
    suppliedTransaction?: Transaction
  ) {
    if (purpose === 'REPLACEMENT') this.validateProposalInput(input);
    else this.validateWithdrawalInput(input);
    const work = async (transaction: Transaction) => {
      await this.requirePermission(actorId, PROPOSE, transaction);
      const target = await this.proposalForUpdate(targetProposalId, transaction);
      if (target.status !== 'APPROVED') throw new Error('COMPONENT_LIFE_LIMIT_INVALID_REVISION_TARGET');
      const [proposal] = await sequelize.query<ProposalRow>(
        `INSERT INTO public.component_life_limit_proposals (
          component_model_id, lineage_id, revision_number, proposal_purpose,
          target_proposal_id, determination, applicability_scope,
          applicability_statement, narrower_effectivity_absent, limit_type, basis,
          limit_hours, limit_cycles, limit_months, source_reference,
          source_document_reference, source_effective_date, evidence_summary,
          proposal_reason, proposed_by
        ) VALUES (
          :component_model_id, :lineage_id, :revision_number, :purpose,
          :targetProposalId, :determination, :applicability_scope,
          :applicability_statement, :narrower_effectivity_absent, :limit_type,
          :basis, :limit_hours, :limit_cycles, :limit_months, :source_reference,
          :source_document_reference, :source_effective_date, :evidence_summary,
          :proposal_reason, :actorId
        ) RETURNING *;`,
        {
          replacements: this.replacements({
            ...input,
            component_model_id: target.component_model_id,
            determination: purpose === 'WITHDRAWAL' ? target.determination : input.determination,
            lineage_id: target.lineage_id,
            revision_number: target.revision_number + 1,
            purpose,
            targetProposalId,
            actorId,
          }),
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const event = purpose === 'REPLACEMENT' ? 'REPLACEMENT_PROPOSED' : 'WITHDRAWAL_PROPOSED';
      await this.history(transaction, proposal!, null, event, actorId, input.proposal_reason, false, null, 'PROPOSED', {}, this.snapshot(proposal!));
      return proposal!;
    };
    if (suppliedTransaction) { await this.requireSerializable(suppliedTransaction); return work(suppliedTransaction); }
    return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, work);
  }

  static async approve(actorId: string, proposalId: string, decisionReason: string, evidenceConfirmed: boolean, suppliedTransaction?: Transaction) {
    if (!evidenceConfirmed) throw new Error('COMPONENT_LIFE_LIMIT_EVIDENCE_CONFIRMATION_REQUIRED');
    this.requireText(decisionReason, 'decision_reason');
    const work = async (transaction: Transaction) => {
      await this.requirePermission(actorId, APPROVE, transaction);
      const proposal = await this.proposalForUpdate(proposalId, transaction);
      if (proposal.status !== 'PROPOSED') throw new Error('COMPONENT_LIFE_LIMIT_INVALID_TRANSITION');
      if (proposal.proposed_by === actorId) throw new Error('COMPONENT_LIFE_LIMIT_SELF_DECISION_FORBIDDEN');
      const [decision] = await sequelize.query<{ publication_id: string | null }>(
        `SELECT public.fn_cllg_decide_proposal(:proposalId,:actorId,'APPROVED',:decisionReason,true) AS publication_id;`,
        { replacements: { proposalId, actorId, decisionReason }, type: QueryTypes.SELECT, transaction }
      );
      const approved = await this.proposalForUpdate(proposalId, transaction);
      const publication = decision?.publication_id
        ? (await sequelize.query<PublicationRow>(`SELECT * FROM public.component_life_limit_publications WHERE id=:id;`, { replacements: { id: decision.publication_id }, type: QueryTypes.SELECT, transaction }))[0] || null
        : null;
      return { proposal: approved, publication };
    };
    if (suppliedTransaction) { await this.requireSerializable(suppliedTransaction); return work(suppliedTransaction); }
    return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, work);
  }

  static async reject(actorId: string, proposalId: string, decisionReason: string, suppliedTransaction?: Transaction) {
    this.requireText(decisionReason, 'decision_reason');
    const work = async (transaction: Transaction) => {
      await this.requirePermission(actorId, APPROVE, transaction);
      const proposal = await this.proposalForUpdate(proposalId, transaction);
      if (proposal.status !== 'PROPOSED') throw new Error('COMPONENT_LIFE_LIMIT_INVALID_TRANSITION');
      if (proposal.proposed_by === actorId) throw new Error('COMPONENT_LIFE_LIMIT_SELF_DECISION_FORBIDDEN');
      await sequelize.query(
        `SELECT public.fn_cllg_decide_proposal(:proposalId,:actorId,'REJECTED',:decisionReason,false);`,
        { replacements: { proposalId, actorId, decisionReason }, transaction }
      );
      return this.proposalForUpdate(proposalId, transaction);
    };
    if (suppliedTransaction) { await this.requireSerializable(suppliedTransaction); return work(suppliedTransaction); }
    return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, work);
  }

  private static async terminateTarget(transaction: Transaction, request: ProposalRow, actorId: string, reason: string) {
    const target = await this.proposalForUpdate(request.target_proposal_id!, transaction);
    const [publication] = await sequelize.query<PublicationRow>(
      `SELECT * FROM public.component_life_limit_publications WHERE proposal_id = :targetId FOR UPDATE;`,
      { replacements: { targetId: target.id }, type: QueryTypes.SELECT, transaction }
    );
    if (!publication || !['DORMANT', 'ACTIVE'].includes(publication.publication_state)) throw new Error('COMPONENT_LIFE_LIMIT_INVALID_REVISION_TARGET');
    const targetStatus = request.proposal_purpose === 'REPLACEMENT' ? 'SUPERSEDED' : 'WITHDRAWN';
    const event = request.proposal_purpose === 'REPLACEMENT' ? 'PUBLICATION_SUPERSEDED' : 'PUBLICATION_WITHDRAWN';
    await sequelize.query(
      `UPDATE public.component_life_limit_proposals SET status = :targetStatus, updated_at = CURRENT_TIMESTAMP WHERE id = :targetId;
       UPDATE public.component_life_limit_publications SET publication_state = :targetStatus,
       terminal_by = :actorId, terminal_at = CURRENT_TIMESTAMP, terminal_reason = :reason,
       updated_at = CURRENT_TIMESTAMP WHERE id = :publicationId;
       UPDATE public.component_life_limits SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = :limitId;`,
      { replacements: { targetStatus, targetId: target.id, actorId, reason, publicationId: publication.id, limitId: publication.component_life_limit_id }, transaction }
    );
    await this.history(transaction, request, publication.id, event, actorId, reason, true, publication.publication_state, targetStatus, this.snapshot({ proposal: target, publication }), this.snapshot({ proposal: { ...target, status: targetStatus }, publication: { ...publication, publication_state: targetStatus } }));
  }

  private static async requirePermission(actorId: string, permissionCode: string, transaction: Transaction) {
    const [row] = await sequelize.query<{ allowed: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN rf_role_permissions rp ON rp.role_id = ur.role_id
        JOIN rf_permission p ON p.id = rp.permission_id
        WHERE ur.user_id = :actorId AND p.code = :permissionCode AND p.is_active = true
      ) AS allowed;`,
      { replacements: { actorId, permissionCode }, type: QueryTypes.SELECT, transaction }
    );
    if (!row?.allowed) throw new Error(`COMPONENT_LIFE_LIMIT_PERMISSION_DENIED:${permissionCode}`);
  }

  private static async requireSerializable(transaction: Transaction) {
    const [row] = await sequelize.query<{ transaction_isolation: string }>(
      `SHOW transaction_isolation;`, { type: QueryTypes.SELECT, transaction }
    );
    if (row?.transaction_isolation !== 'serializable') {
      throw new Error('COMPONENT_LIFE_LIMIT_SERIALIZABLE_TRANSACTION_REQUIRED');
    }
  }

  private static async proposalForUpdate(id: string, transaction: Transaction) {
    const [proposal] = await sequelize.query<ProposalRow>(
      `SELECT * FROM public.component_life_limit_proposals WHERE id = :id FOR UPDATE;`,
      { replacements: { id }, type: QueryTypes.SELECT, transaction }
    );
    if (!proposal) throw new Error('COMPONENT_LIFE_LIMIT_PROPOSAL_NOT_FOUND');
    return proposal;
  }

  private static async history(transaction: Transaction, proposal: ProposalRow, publicationId: string | null, eventCode: string, actorId: string, reason: string, evidenceConfirmed: boolean, fromStatus: string | null, toStatus: string, before: object, after: object) {
    await sequelize.query(
      `INSERT INTO public.component_life_limit_governance_history
       (proposal_id, publication_id, event_code, actor_id, reason, evidence_confirmed,
        from_status, to_status, before_snapshot, after_snapshot)
       VALUES (:proposalId, :publicationId, :eventCode, :actorId, :reason,
        :evidenceConfirmed, :fromStatus, :toStatus, CAST(:before AS jsonb), CAST(:after AS jsonb));`,
      { replacements: { proposalId: proposal.id, publicationId, eventCode, actorId, reason, evidenceConfirmed, fromStatus, toStatus, before: JSON.stringify(before), after: JSON.stringify(after) }, transaction }
    );
  }

  private static validateProposalInput(input: LifeLimitProposalInput) {
    if (input.applicability_scope !== 'ALL_SERIALS_OF_MODEL' || input.narrower_effectivity_absent !== true) throw new Error('COMPONENT_LIFE_LIMIT_APPLICABILITY_NOT_SUPPORTED');
    for (const field of ['applicability_statement', 'source_reference', 'source_effective_date', 'evidence_summary', 'proposal_reason'] as const) this.requireText(input[field], field);
    const valid = input.determination !== 'LIFE_LIMITED' || [
      ['TBO_HOURS', 'SINCE_OVERHAUL', input.limit_hours, input.limit_cycles, input.limit_months],
      ['TBO_CYCLES', 'SINCE_OVERHAUL', input.limit_cycles, input.limit_hours, input.limit_months],
      ['LIFE_LIMIT_HOURS', 'SINCE_NEW', input.limit_hours, input.limit_cycles, input.limit_months],
      ['LIFE_LIMIT_CYCLES', 'SINCE_NEW', input.limit_cycles, input.limit_hours, input.limit_months],
      ['CALENDAR_LIFE', 'CALENDAR', input.limit_months, input.limit_hours, input.limit_cycles],
    ].some(([type, basis, value, otherA, otherB]) => input.limit_type === type && input.basis === basis && Number(value) > 0 && otherA == null && otherB == null);
    if (!valid) throw new Error('COMPONENT_LIFE_LIMIT_INVALID_DIMENSION');
    if (input.determination !== 'LIFE_LIMITED' && [input.limit_type, input.basis, input.limit_hours, input.limit_cycles, input.limit_months].some((value) => value != null)) throw new Error('COMPONENT_LIFE_LIMIT_INVALID_DETERMINATION_PAYLOAD');
  }

  private static validateWithdrawalInput(input: LifeLimitProposalInput) {
    if (input.applicability_scope !== 'ALL_SERIALS_OF_MODEL' || input.narrower_effectivity_absent !== true) throw new Error('COMPONENT_LIFE_LIMIT_APPLICABILITY_NOT_SUPPORTED');
    for (const field of ['applicability_statement', 'source_reference', 'source_effective_date', 'evidence_summary', 'proposal_reason'] as const) this.requireText(input[field], field);
    if ([input.limit_type, input.basis, input.limit_hours, input.limit_cycles, input.limit_months].some((value) => value != null)) throw new Error('COMPONENT_LIFE_LIMIT_INVALID_WITHDRAWAL_PAYLOAD');
  }

  private static requireText(value: unknown, field: string) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`COMPONENT_LIFE_LIMIT_REQUIRED:${field}`);
  }

  private static replacements(values: Record<string, unknown>) {
    return Object.fromEntries(Object.entries({
      target: null,
      limit_type: null,
      basis: null,
      limit_hours: null,
      limit_cycles: null,
      limit_months: null,
      source_document_reference: null,
      ...values,
    }).map(([key, value]) => [key, value === undefined ? null : value]));
  }

  private static snapshot(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }
}
