import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac.middleware.js';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('src/modules/library/library.routes.ts');
const controller = read('src/modules/library/component-life-limit-governance.controller.ts');
const form = read('src/views/library/life-limit-governance/form.ejs');
const detail = read('src/views/library/life-limit-governance/detail.ejs');
const index = read('src/views/library/life-limit-governance/index.ejs');

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
  });

  it('invokes only the Phase 1A service for governed writes and shows friendly conflicts', () => {
    for (const call of ['.propose(', '.approve(', '.reject(', '.proposeRevision(']) expect(controller).toContain(call);
    expect(controller).not.toMatch(/UPDATE public\.|INSERT INTO public\.|DELETE FROM public\./);
    expect(controller).toContain('Independent approval is mandatory');
    expect(controller).toContain('Reload it and review the current state');
  });
});
