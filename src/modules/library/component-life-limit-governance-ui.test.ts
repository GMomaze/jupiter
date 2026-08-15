import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ejs from 'ejs';
import { describe, expect, it, vi } from 'vitest';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac.middleware.js';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('src/modules/library/library.routes.ts');
const controller = read('src/modules/library/component-life-limit-governance.controller.ts');
const form = read('src/views/library/life-limit-governance/form.ejs');
const detail = read('src/views/library/life-limit-governance/detail.ejs');
const index = read('src/views/library/life-limit-governance/index.ejs');
const buttonStyles = read('src/tailwind/input.css');
const compiledButtonStyles = read('public/css/styles.css');
const flashMessages = read('src/views/partials/flash-messages.ejs');

function renderGovernanceIndex(canPropose: boolean): string {
  return ejs.render(
    index.replace(/<%- include\([^)]*\) %>/g, ''),
    { canPropose, proposals: [] }
  );
}

function renderGovernanceForm(): string {
  return ejs.render(form.replace(/<%- include\([^)]*\) %>/g, ''), {
    title: 'New Life-Limit Proposal',
    target: null,
    purpose: 'ESTABLISH',
    models: [],
    form: {},
    errors: [],
    csrfToken: 'render-test-csrf',
  });
}

function renderGovernanceDetail(overrides: Record<string, unknown>): string {
  return ejs.render(detail.replace(/<%- include\([^)]*\) %>/g, ''), {
    proposal: {
      id: 'proposal-id',
      proposed_by: 'proposer-id',
      manufacturer_name: 'Test Manufacturer',
      model_name: 'Test Model',
      status: 'PROPOSED',
      proposal_purpose: 'ESTABLISH',
      revision_number: 1,
      lineage_id: 'lineage-id',
      applicability_scope: 'ALL_SERIALS_OF_MODEL',
      applicability_statement: 'All serials of model',
      source_effective_date: '2026-08-14',
      source_reference: 'TEST',
      source_document_reference: 'TEST-DOC',
      evidence_summary: 'Evidence',
      proposal_reason: 'Reason',
      proposer_name: 'Proposer',
      publication_id: null,
      publication_state: null,
      ...overrides,
    },
    currentUserId: 'different-user-id',
    canPropose: false,
    canApprove: false,
    canActivate: false,
    history: [],
    legacyLimits: [],
    csrfToken: 'render-test-csrf',
    ...overrides,
  });
}

function invoke(middleware: ReturnType<typeof requirePermission>, user: any) {
  const req = { user, headers: { accept: 'application/json' } } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), render: vi.fn() } as any;
  const next = vi.fn();
  middleware(req, res, next);
  return { res, next };
}

describe('component life-limit governance Phase 1B UI contract', () => {
  it('uses exact dedicated RBAC and CSRF on every mutation route', () => {
    expect(routes).toContain("requireAnyPermission(\n  'COMPONENT_LIFE_LIMIT_PROPOSE',\n  'COMPONENT_LIFE_LIMIT_APPROVE'");
    for (const fragment of [
      "router.post('/life-limit-governance/proposals', requirePermission('COMPONENT_LIFE_LIMIT_PROPOSE'), csrfProtection",
      "router.post('/life-limit-governance/proposals/:id/approve', requirePermission('COMPONENT_LIFE_LIMIT_APPROVE'), csrfProtection",
      "router.post('/life-limit-governance/proposals/:id/reject', requirePermission('COMPONENT_LIFE_LIMIT_APPROVE'), csrfProtection",
      "router.post('/life-limit-governance/proposals/:id/replacement', requirePermission('COMPONENT_LIFE_LIMIT_PROPOSE'), csrfProtection",
      "router.post('/life-limit-governance/proposals/:id/withdrawal', requirePermission('COMPONENT_LIFE_LIMIT_PROPOSE'), csrfProtection",
      "router.post('/life-limit-governance/publications/:id/activate', requirePermission('COMPONENT_LIFE_LIMIT_ACTIVATE'), csrfProtection",
    ]) expect(routes).toContain(fragment);
    expect(routes).not.toContain("'/life-limit-governance', requirePermission('LIBRARY_EDIT')");
  });

  it('returns 403 for crafted requests without governance authority', () => {
    const engineer = { roles: [{ code: 'ENGINEER', permissions: [{ code: 'COMPONENT_LIFE_LIMIT_PROPOSE' }] }] };
    const qa = { roles: [{ code: 'QA', permissions: [{ code: 'COMPONENT_LIFE_LIMIT_APPROVE' }] }] };
    const viewer = { roles: [{ code: 'VIEWER', permissions: [] }] };
    expect(invoke(requirePermission('COMPONENT_LIFE_LIMIT_PROPOSE'), engineer).next).toHaveBeenCalled();
    expect(invoke(requirePermission('COMPONENT_LIFE_LIMIT_PROPOSE'), qa).res.status).toHaveBeenCalledWith(403);
    expect(invoke(requirePermission('COMPONENT_LIFE_LIMIT_APPROVE'), engineer).res.status).toHaveBeenCalledWith(403);
    expect(invoke(requirePermission('COMPONENT_LIFE_LIMIT_APPROVE'), qa).next).toHaveBeenCalled();
    expect(invoke(requireAnyPermission('COMPONENT_LIFE_LIMIT_PROPOSE', 'COMPONENT_LIFE_LIMIT_APPROVE'), viewer).res.status).toHaveBeenCalledWith(403);
  });

  it('offers exactly the five controlled combinations and no ON_CONDITION or planning defaults', () => {
    for (const code of ['TBO_HOURS','TBO_CYCLES','LIFE_LIMIT_HOURS','LIFE_LIMIT_CYCLES','CALENDAR_LIFE']) expect(form).toContain(`value="${code}"`);
    expect(form).not.toContain('ON_CONDITION');
    expect(form).not.toMatch(/default_tbo|service_interval|overhaul_interval/i);
    expect(form).toContain('ALL_SERIALS_OF_MODEL');
    expect(form).toContain('narrower effectivity are not allowed');
    expect(controller).toContain("Phase 1 supports ALL_SERIALS_OF_MODEL only");
    expect(controller).toContain("if (!basisByType[type])");
  });

  it('renders independent decision, dormant publication, history, and legacy separation safely', () => {
    expect(detail).toContain('Approval creates a governed but dormant publication');
    expect(detail).toContain("canApprove && proposal.status === 'PROPOSED' && proposal.proposed_by !== currentUserId");
    expect(detail).toContain('Immutable transition history');
    expect(detail).toContain('LEGACY_UNREVIEWED');
    expect(detail).toContain('operational limit active');
    expect(index).toContain('canPropose');
    for (const view of [index, form, detail]) expect(view).toContain("include('../../partials/flash-messages')");
    expect(flashMessages).toContain('role="status"');
    expect(flashMessages).toContain('role="alert"');
    expect(flashMessages).toContain('<%= message %>');
    expect(controller).toContain('Proposal approved. Dormant publication created.');
  });

  it('renders the established visible primary action only for authorised proposers', () => {
    const authorised = renderGovernanceIndex(true);
    const reviewOnly = renderGovernanceIndex(false);

    expect(authorised).toContain(
      'href="/library/life-limit-governance/proposals/new"'
    );
    expect(authorised).toContain('New proposal');
    expect(authorised).toContain('class="btn btn-primary"');
    expect(authorised).toContain('btn-action-bar');
    expect(reviewOnly).not.toContain(
      '/library/life-limit-governance/proposals/new'
    );
    expect(reviewOnly).not.toContain('New proposal');
  });

  it('keeps the complete proposal form and its primary and secondary actions visible', () => {
    const rendered = renderGovernanceForm();
    const formStart = rendered.indexOf('<form');
    const formEnd = rendered.indexOf('</form>');
    const submit = rendered.indexOf('Submit for independent review');
    const cancel = rendered.indexOf('Cancel / Back');

    expect(rendered).toContain('max-w-3xl');
    expect(rendered).toContain(
      'action="/library/life-limit-governance/proposals"'
    );
    expect(rendered).toContain('name="_csrf" value="render-test-csrf"');
    expect(rendered).toContain('class="btn btn-secondary"');
    expect(rendered).toContain('class="btn btn-primary"');
    expect(rendered).toContain('href="/library/life-limit-governance"');
    expect(rendered).toContain('class="btn-action-bar pt-2"');
    expect(submit).toBeGreaterThan(formStart);
    expect(cancel).toBeGreaterThan(formStart);
    expect(submit).toBeLessThan(formEnd);
    expect(cancel).toBeLessThan(formEnd);
  });

  it('renders visible controlled detail actions only under their existing authority conditions', () => {
    const reviewer = renderGovernanceDetail({ canApprove: true });
    const activator = renderGovernanceDetail({
      canActivate: true,
      publication_id: 'publication-id',
      publication_state: 'DORMANT',
    });
    const proposer = renderGovernanceDetail({
      canPropose: true,
      status: 'APPROVED',
      publication_id: 'publication-id',
      publication_state: 'DORMANT',
    });
    const reviewOnly = renderGovernanceDetail({});

    expect(reviewer).toContain('action="/library/life-limit-governance/proposals/proposal-id/approve"');
    expect(reviewer).toContain('class="btn btn-primary"');
    expect(reviewer).toContain('action="/library/life-limit-governance/proposals/proposal-id/reject"');
    expect(reviewer).toContain('class="btn btn-danger"');
    expect(activator).toContain('action="/library/life-limit-governance/publications/publication-id/activate"');
    expect(activator).toContain('class="btn btn-success"');
    expect(activator).toContain('name="_csrf" value="render-test-csrf"');
    expect(proposer).toContain('href="/library/life-limit-governance/proposals/proposal-id/replacement/new"');
    expect(proposer).toContain('class="btn btn-warning"');
    expect(proposer).toContain('href="/library/life-limit-governance/proposals/proposal-id/withdrawal/new"');
    expect(proposer).toContain('class="btn btn-danger"');
    expect(reviewOnly).not.toContain('/approve"');
    expect(reviewOnly).not.toContain('/reject"');
    expect(reviewOnly).not.toContain('/activate"');
    expect(reviewOnly).not.toContain('/replacement/new"');
    expect(reviewOnly).not.toContain('/withdrawal/new"');
  });

  it('defines one accessible reusable button system for semantic controls and responsive action bars', () => {
    for (const variant of [
      'primary',
      'secondary',
      'success',
      'warning',
      'danger',
    ]) {
      expect(buttonStyles).toContain(`.btn-${variant}`);
      expect(buttonStyles).toContain(`.btn-${variant}:hover`);
      expect(buttonStyles).toContain(`.btn-${variant}:focus-visible`);
    }

    expect(buttonStyles).toContain('min-height: 44px');
    expect(buttonStyles).toContain('background-color: #1d4ed8');
    expect(buttonStyles).toContain('background-color: #ffffff');
    expect(buttonStyles).toContain('background-color: #047857');
    expect(buttonStyles).toContain('background-color: #92400e');
    expect(buttonStyles).toContain('background-color: #be123c');
    expect(buttonStyles).toContain('color: #ffffff');
    expect(buttonStyles).toContain('color: #1e293b');
    expect(buttonStyles).toContain('button.btn:disabled');
    expect(buttonStyles).toContain('input.btn:disabled');
    expect(buttonStyles).toContain('cursor: not-allowed');
    expect(buttonStyles).toContain('flex-wrap: wrap');
    expect(buttonStyles).toContain('max-width: 100%');
    expect(compiledButtonStyles).toContain('.btn-primary');
    expect(compiledButtonStyles).toContain('min-height: 44px');
    expect(compiledButtonStyles).toContain('.btn-danger:focus-visible');
    expect(compiledButtonStyles).toContain('button.btn:disabled');

    for (const rendered of [
      renderGovernanceForm(),
      renderGovernanceDetail({ canApprove: true }),
      renderGovernanceDetail({
        canActivate: true,
        publication_id: 'publication-id',
        publication_state: 'DORMANT',
      }),
    ]) {
      expect(rendered).not.toContain('aria-disabled');
      expect(rendered).not.toContain('bg-indigo-700');
    }
    expect(renderGovernanceForm()).toMatch(
      /<button type="submit" class="btn btn-primary">Submit for independent review<\/button>/
    );
  });

  it('invokes only the Phase 1A service for governed writes and shows friendly conflicts', () => {
    for (const call of ['.propose(', '.approve(', '.reject(', '.proposeRevision(']) expect(controller).toContain(call);
    expect(controller).not.toMatch(/UPDATE public\.|INSERT INTO public\.|DELETE FROM public\./);
    expect(controller).toContain('Independent approval is mandatory');
    expect(controller).toContain('Reload it and review the current state');
  });
});
