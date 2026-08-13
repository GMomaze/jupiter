import { NextFunction, Request, Response } from 'express';
import { ComponentLifeLimitGovernanceService, type LifeLimitProposalInput } from './component-life-limit-governance.service.js';

const text = (value: unknown) => String(value ?? '').trim();
const actorId = (req: Request) => String((req.user as any)?.id || '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONTROLLED_FIELDS = new Set(['basis','determination','proposed_by','decision_by','status','revision_number','lineage_id','proposal_id','publication_id','history_id','published_by','terminal_by','is_active']);

class GovernanceInputError extends Error {
  constructor(message: string, readonly status = 422) { super(message); }
}

function validDate(value: string) {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function validateUuid(value: string, message: string, status = 422) {
  if (!UUID.test(value)) throw new GovernanceInputError(message, status);
  return value;
}

function rejectControlledInput(body: Record<string, any>) {
  if (Object.keys(body).some((key) => CONTROLLED_FIELDS.has(key))) {
    throw new GovernanceInputError('Workflow-controlled fields cannot be submitted.');
  }
  if (Object.keys(body).some((key) => key !== 'narrower_effectivity_absent' && /serial|configuration|modification|suffix|effectivity|range|batch/i.test(key))) {
    throw new GovernanceInputError('Phase 1 supports ALL_SERIALS_OF_MODEL only; narrower effectivity is not permitted.');
  }
}
function hasPermission(req: Request, code: string) {
  const roles = (req.user as any)?.roles || [];
  if (roles.some((role: any) => (typeof role === 'string' ? role : role?.code) === 'ADMIN')) return true;
  return roles.flatMap((role: any) => role?.permissions || role?.Permissions || [])
    .some((permission: any) => (typeof permission === 'string' ? permission : permission?.code) === code);
}

function inputFrom(body: Record<string, any>): LifeLimitProposalInput {
  rejectControlledInput(body);
  const type = text(body.limit_type);
  const value = Number(body.limit_value);
  const basisByType: Record<string, LifeLimitProposalInput['basis']> = {
    TBO_HOURS: 'SINCE_OVERHAUL', TBO_CYCLES: 'SINCE_OVERHAUL',
    LIFE_LIMIT_HOURS: 'SINCE_NEW', LIFE_LIMIT_CYCLES: 'SINCE_NEW', CALENDAR_LIFE: 'CALENDAR',
  };
  if (!basisByType[type]) throw new GovernanceInputError('Select an approved limit type and basis.');
  const integerDimension = type.endsWith('CYCLES') || type === 'CALENDAR_LIFE';
  const maximum = integerDimension ? 2147483647 : 99999999.99;
  if (!Number.isFinite(value) || value <= 0 || value > maximum || integerDimension && !Number.isInteger(value) || !integerDimension && !/^\d{1,8}(?:\.\d{1,2})?$/.test(text(body.limit_value))) {
    throw new GovernanceInputError('Enter one positive limit value; cycles and months must be whole numbers.');
  }
  validateUuid(text(body.component_model_id), 'Select a valid component model.');
  if (!validDate(text(body.source_effective_date))) throw new GovernanceInputError('Enter a valid authority effective date.');
  for (const field of ['component_model_id','source_reference','source_document_reference','source_effective_date','evidence_summary','proposal_reason']) {
    if (!text(body[field])) throw new GovernanceInputError(`Complete the required ${field.replaceAll('_', ' ')} field.`);
  }
  if (text(body.applicability_scope) !== 'ALL_SERIALS_OF_MODEL' || body.narrower_effectivity_absent !== 'true') {
    throw new GovernanceInputError('Phase 1 supports ALL_SERIALS_OF_MODEL only; narrower effectivity is not permitted.');
  }
  return {
    component_model_id: text(body.component_model_id), determination: 'LIFE_LIMITED',
    applicability_scope: 'ALL_SERIALS_OF_MODEL', applicability_statement: text(body.applicability_statement) || 'All serials of model',
    narrower_effectivity_absent: true, limit_type: type as NonNullable<LifeLimitProposalInput['limit_type']>, basis: basisByType[type]!,
    limit_hours: type.endsWith('HOURS') ? value : null,
    limit_cycles: type.endsWith('CYCLES') ? value : null,
    limit_months: type === 'CALENDAR_LIFE' ? value : null,
    source_reference: text(body.source_reference), source_document_reference: text(body.source_document_reference),
    source_effective_date: text(body.source_effective_date), evidence_summary: text(body.evidence_summary), proposal_reason: text(body.proposal_reason),
  };
}

const DOMAIN_MESSAGES = new Map<string, string>([
  ['COMPONENT_LIFE_LIMIT_SELF_DECISION_FORBIDDEN', 'Independent approval is mandatory; proposers cannot decide their own proposals.'],
  ['COMPONENT_LIFE_LIMIT_INVALID_TRANSITION', 'This proposal has already been decided. Reload it and review the current state.'],
  ['COMPONENT_LIFE_LIMIT_INVALID_REVISION_TARGET', 'The governed target is no longer available for this revision. Reload it and review the current state.'],
  ['COMPONENT_LIFE_LIMIT_EVIDENCE_CONFIRMATION_REQUIRED', 'Confirm the evidence before approving this proposal.'],
  ['COMPONENT_LIFE_LIMIT_PERMISSION_DENIED', 'You do not have permission to perform this governance action.'],
]);

function friendly(error: any) {
  if (error instanceof GovernanceInputError) return error.message;
  const message = String(error?.message || '');
  for (const [code, safe] of DOMAIN_MESSAGES) if (message.includes(code)) return safe;
  if (message.includes('could not serialize')) return 'This proposal changed while you were working. Reload it and review the current state.';
  return 'The governed life-limit action could not be completed. No changes were saved.';
}

async function renderForm(res: Response, status: number, options: Record<string, any> = {}) {
  const models = await ComponentLifeLimitGovernanceService.modelOptions();
  return res.status(status).render('library/life-limit-governance/form', { title: options.title || 'New Life-Limit Proposal', models, form: options.form || {}, errors: options.errors || [], target: options.target || null, purpose: options.purpose || 'ESTABLISH' });
}

export class ComponentLifeLimitGovernanceController {
  static async list(req: Request, res: Response) { res.render('library/life-limit-governance/index', { title: 'Component Life-Limit Governance', proposals: await ComponentLifeLimitGovernanceService.list(), canPropose: hasPermission(req, 'COMPONENT_LIFE_LIMIT_PROPOSE') }); }
  static async newProposal(_req: Request, res: Response) { return renderForm(res, 200); }
  static async create(req: Request, res: Response) {
    try { const input = inputFrom(req.body); if (!await ComponentLifeLimitGovernanceService.modelExists(input.component_model_id)) throw new GovernanceInputError('Select an existing active component model.'); const proposal = await ComponentLifeLimitGovernanceService.propose(actorId(req), input); req.flash('success', 'Governed life-limit proposal created for independent review.'); return res.redirect(`/library/life-limit-governance/proposals/${proposal.id}`); }
    catch (error) { return renderForm(res, 422, { form: req.body, errors: [friendly(error)] }); }
  }
  static async detail(req: Request, res: Response, next: NextFunction) { try { const id=validateUuid(String(req.params.id), 'Proposal not found.', 404); const data = await ComponentLifeLimitGovernanceService.detail(id); return res.render('library/life-limit-governance/detail', { title: 'Life-Limit Proposal', ...data, currentUserId: actorId(req), canPropose: hasPermission(req, 'COMPONENT_LIFE_LIMIT_PROPOSE'), canApprove: hasPermission(req, 'COMPONENT_LIFE_LIMIT_APPROVE') }); } catch(error) { if (error instanceof GovernanceInputError || String((error as any)?.message).includes('PROPOSAL_NOT_FOUND')) return res.status(404).send('Governed life-limit proposal not found.'); return next(error); } }
  private static async decide(req: Request, res: Response, action: 'approve' | 'reject') {
    try { if (action === 'approve') await ComponentLifeLimitGovernanceService.approve(actorId(req), String(req.params.id), text(req.body.decision_reason), req.body.evidence_confirmed === 'true'); else await ComponentLifeLimitGovernanceService.reject(actorId(req), String(req.params.id), text(req.body.decision_reason)); req.flash('success', `Proposal ${action === 'approve' ? 'approved' : 'rejected'} with immutable history.`); }
    catch (error) { req.flash('error', friendly(error)); }
    return res.redirect(`/library/life-limit-governance/proposals/${req.params.id}`);
  }
  static approve(req: Request, res: Response) { return ComponentLifeLimitGovernanceController.decide(req, res, 'approve'); }
  static reject(req: Request, res: Response) { return ComponentLifeLimitGovernanceController.decide(req, res, 'reject'); }
  private static async revisionForm(req: Request, res: Response, purpose: 'REPLACEMENT' | 'WITHDRAWAL') { try { const id=validateUuid(String(req.params.id), 'Proposal not found.', 404); const data = await ComponentLifeLimitGovernanceService.detail(id); return renderForm(res, 200, { title: `${purpose === 'REPLACEMENT' ? 'Replacement' : 'Withdrawal'} Proposal`, target: data.proposal, purpose }); } catch(error) { if (error instanceof GovernanceInputError || String((error as any)?.message).includes('PROPOSAL_NOT_FOUND')) return res.status(404).send('Governed life-limit proposal not found.'); throw error; } }
  static newReplacement(req: Request, res: Response) { return ComponentLifeLimitGovernanceController.revisionForm(req, res, 'REPLACEMENT'); }
  static newWithdrawal(req: Request, res: Response) { return ComponentLifeLimitGovernanceController.revisionForm(req, res, 'WITHDRAWAL'); }
  private static async createRevision(req: Request, res: Response, purpose: 'REPLACEMENT' | 'WITHDRAWAL') {
    try {
      const targetId = validateUuid(String(req.params.id), 'Proposal not found.', 404);
      const base = purpose === 'WITHDRAWAL' ? { ...req.body, limit_type: 'TBO_HOURS', limit_value: '1' } : req.body;
      const input = inputFrom(base);
      if (purpose === 'WITHDRAWAL') Object.assign(input, { limit_type: null, basis: null, limit_hours: null, limit_cycles: null, limit_months: null });
      const proposal = await ComponentLifeLimitGovernanceService.proposeRevision(actorId(req), targetId, purpose, input);
      req.flash('success', `${purpose === 'REPLACEMENT' ? 'Replacement' : 'Withdrawal'} proposal created for independent approval.`);
      return res.redirect(`/library/life-limit-governance/proposals/${proposal.id}`);
    } catch (error) { if (error instanceof GovernanceInputError && error.status === 404 || String((error as any)?.message).includes('PROPOSAL_NOT_FOUND')) return res.status(404).send('Governed life-limit proposal not found.'); let target; try { target=(await ComponentLifeLimitGovernanceService.detail(String(req.params.id))).proposal; } catch { return res.status(404).send('Governed life-limit proposal not found.'); } return renderForm(res, 422, { form: req.body, errors: [friendly(error)], target, purpose }); }
  }
  static createReplacement(req: Request, res: Response) { return ComponentLifeLimitGovernanceController.createRevision(req, res, 'REPLACEMENT'); }
  static createWithdrawal(req: Request, res: Response) { return ComponentLifeLimitGovernanceController.createRevision(req, res, 'WITHDRAWAL'); }
}
