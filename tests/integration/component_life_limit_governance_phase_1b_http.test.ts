import { randomUUID } from 'node:crypto';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import csrf from 'csurf';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import sequelize from '../../src/config/database.js';
import libraryRoutes from '../../src/modules/library/library.routes.js';
import { ComponentLifeLimitGovernanceService } from '../../src/modules/library/component-life-limit-governance.service.js';

type Actor = { id: string; role: string };
const actors: Record<string, Actor> = {};
let modelId = '';
let manufacturerId = '';
let assetId = '';
const ownedUserIds: string[] = [];

function app() {
  const instance = express();
  instance.set('view engine', 'ejs');
  instance.set('views', 'src/views');
  instance.use(express.urlencoded({ extended: false }));
  instance.use(session({ secret: 'phase-1b-http-test', resave: false, saveUninitialized: true }));
  instance.use(flash());
  instance.use((req, res, next) => {
    const actor = actors[String(req.headers['x-test-actor'] || '')];
    if (actor) {
      const permissions = actor.role === 'ENGINEER' ? [{ code: 'COMPONENT_LIFE_LIMIT_PROPOSE' }]
        : actor.role === 'QA' ? [{ code: 'COMPONENT_LIFE_LIMIT_APPROVE' }, { code: 'COMPONENT_LIFE_LIMIT_ACTIVATE' }] : [];
      (req as any).user = { id: actor.id, full_name: actor.role, roles: [{ code: actor.role, permissions }] };
      (req as any).isAuthenticated = () => true;
    } else (req as any).isAuthenticated = () => false;
    res.locals.user = (req as any).user || null;
    res.locals.remoteTestMode = false;
    res.locals.messages = req.flash();
    next();
  });
  instance.use(csrf());
  instance.use((req, res, next) => { res.locals.csrfToken = req.csrfToken(); next(); });
  instance.use('/library', libraryRoutes);
  instance.use((error: any, _req: any, res: any, _next: any) => {
    if (error?.code === 'EBADCSRFTOKEN') return res.status(403).send('Invalid CSRF token.');
    return res.status(500).send('Unexpected server error.');
  });
  return instance;
}

function token(html: string) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (!match) throw new Error('CSRF token missing from rendered form');
  return match[1]!;
}

function validBody(type = 'TBO_HOURS', value = '100') {
  return {
    component_model_id: modelId,
    applicability_scope: 'ALL_SERIALS_OF_MODEL',
    applicability_statement: 'All serials of model',
    narrower_effectivity_absent: 'true',
    limit_type: type,
    limit_value: value,
    source_effective_date: '2026-01-31',
    source_reference: 'ICA 04-10-00',
    source_document_reference: 'ICA-REV-4',
    evidence_summary: 'Model-wide authority evidence',
    proposal_reason: 'Establish controlled operational authority',
  };
}

async function csrfFor(agent: request.SuperAgentTest, actor: string, path = '/library/life-limit-governance/proposals/new') {
  const response = await agent.get(path).set('x-test-actor', actor);
  expect(response.status).toBe(200);
  return token(response.text);
}

async function createProposal(agent: request.SuperAgentTest, actor: string, body = validBody()) {
  const csrfToken = await csrfFor(agent, actor);
  const response = await agent.post('/library/life-limit-governance/proposals').set('x-test-actor', actor).type('form').send({ ...body, _csrf: csrfToken });
  expect(response.status, response.text).toBe(302);
  return response.headers.location.split('/').pop()!;
}

beforeAll(async () => {
  const key = randomUUID();
  await sequelize.query(`
    INSERT INTO rf_role_permissions(role_id,permission_id)
    SELECT r.id,p.id FROM rf_role r CROSS JOIN rf_permission p
    WHERE r.code IN ('QA','ADMIN') AND p.code='COMPONENT_LIFE_LIMIT_ACTIVATE'
    ON CONFLICT(role_id,permission_id) DO NOTHING;
  `);
  const [manufacturer] = await sequelize.query<{ id: string }>(
    `INSERT INTO manufacturers(name,code) VALUES(:name,:code) RETURNING id;`,
    { replacements: { name: `Phase 1B HTTP ${key}`, code: `P1B-${key}` }, type: QueryTypes.SELECT }
  );
  const [asset] = await sequelize.query<{ id: string }>(
    `INSERT INTO rf_asset_type(code,label) VALUES(:code,'Phase 1B HTTP') RETURNING id;`,
    { replacements: { code: `P1B-${key}` }, type: QueryTypes.SELECT }
  );
  const [model] = await sequelize.query<{ id: string }>(
    `INSERT INTO component_models(manufacturer_id,model_name,asset_type_id,is_life_limited,is_active) VALUES(:manufacturer,'Phase 1B HTTP model',:asset,false,true) RETURNING id;`,
    { replacements: { manufacturer: manufacturer!.id, asset: asset!.id }, type: QueryTypes.SELECT }
  );
  modelId = model!.id;
  manufacturerId = manufacturer!.id;
  assetId = asset!.id;
  for (const [name, role] of Object.entries({ engineer: 'ENGINEER', qa: 'QA', admin: 'ADMIN', otherAdmin: 'ADMIN', supervisor: 'SUPERVISOR', planner: 'PLANNER', mechanic: 'MECHANIC', viewer: 'VIEWER', referenceAdmin: 'REFERENCE_ADMIN', referenceEditor: 'REFERENCE_EDITOR', referenceViewer: 'REFERENCE_VIEWER' })) {
    const [user] = await sequelize.query<{ id: string }>(
      `INSERT INTO users(email,password_hash,full_name,is_active,created_at,updated_at) VALUES(:email,'test',:name,true,NOW(),NOW()) RETURNING id;`,
      { replacements: { email: `${name}-${key}@test.invalid`, name }, type: QueryTypes.SELECT }
    );
    await sequelize.query(`INSERT INTO user_roles(user_id,role_id) SELECT :user,id FROM rf_role WHERE code=:role;`, { replacements: { user: user!.id, role } });
    actors[name] = { id: user!.id, role };
    ownedUserIds.push(user!.id);
  }
  actors.custom = { id: actors.viewer!.id, role: 'CUSTOM_TEST_ROLE' };
});

describe('Phase 1B real HTTP governance workflow', () => {
  it('requires authentication, exact permissions, and CSRF', async () => {
    const application = app();
    expect((await request(application).get('/library/life-limit-governance')).status).toBe(302);
    expect((await request(application).get('/library/life-limit-governance').set('x-test-actor', 'viewer')).status).toBe(403);
    expect((await request(application).get('/library/life-limit-governance/proposals/new').set('x-test-actor', 'qa')).status).toBe(403);
    expect((await request(application).post('/library/life-limit-governance/proposals').set('x-test-actor', 'engineer').type('form').send(validBody())).status).toBe(403);
  });

  it.each([
    ['TBO_HOURS', '100.25'], ['TBO_CYCLES', '100'], ['LIFE_LIMIT_HOURS', '200.50'],
    ['LIFE_LIMIT_CYCLES', '200'], ['CALENDAR_LIFE', '24'],
  ])('submits approved %s through HTTP into Phase 1A service/database', async (type, value) => {
    const agent = request.agent(app());
    const id = await createProposal(agent, 'engineer', validBody(type, value));
    const [row] = await sequelize.query<any>(`SELECT * FROM component_life_limit_proposals WHERE id=:id;`, { replacements: { id }, type: QueryTypes.SELECT });
    expect(row.status).toBe('PROPOSED');
    expect(row.proposed_by).toBe(actors.engineer!.id);
  });

  it('supports independent approval while rejecting role and self-approval bypasses', async () => {
    const engineerAgent = request.agent(app());
    const qaAgent = request.agent(app());
    const adminAgent = request.agent(app());
    const id = await createProposal(engineerAgent, 'engineer');
    const detailToken = await csrfFor(engineerAgent, 'engineer', `/library/life-limit-governance/proposals/${id}`);
    expect((await engineerAgent.post(`/library/life-limit-governance/proposals/${id}/approve`).set('x-test-actor', 'engineer').type('form').send({ _csrf: detailToken, decision_reason: 'crafted', evidence_confirmed: 'true' })).status).toBe(403);
    const qaToken = await csrfFor(qaAgent, 'qa', `/library/life-limit-governance/proposals/${id}`);
    const approvalResponse = await qaAgent.post(`/library/life-limit-governance/proposals/${id}/approve`).set('x-test-actor', 'qa').type('form').send({ _csrf: qaToken, decision_reason: 'Independent QA approval', evidence_confirmed: 'true' });
    expect(approvalResponse.status).toBe(302);
    const approvalDetail = await qaAgent.get(approvalResponse.headers.location).set('x-test-actor', 'qa');
    expect(approvalDetail.text).toContain('role="status"');
    expect(approvalDetail.text).toContain('Proposal approved. Dormant publication created.');
    const [publication] = await sequelize.query<any>(`SELECT p.publication_state,l.is_active FROM component_life_limit_publications p JOIN component_life_limits l ON l.id=p.component_life_limit_id WHERE p.proposal_id=:id;`, { replacements: { id }, type: QueryTypes.SELECT });
    expect(publication).toMatchObject({ publication_state: 'DORMANT', is_active: false });
    const [publicationId] = await sequelize.query<any>(`SELECT id FROM component_life_limit_publications WHERE proposal_id=:id`, { replacements: { id }, type: QueryTypes.SELECT });
    const activationToken = await csrfFor(qaAgent, 'qa', `/library/life-limit-governance/proposals/${id}`);
    const qaDetail = await qaAgent.get(`/library/life-limit-governance/proposals/${id}`).set('x-test-actor', 'qa');
    expect(qaDetail.text).toContain(`/library/life-limit-governance/publications/${publicationId.id}/activate`);
    expect(qaDetail.text).toContain('Missing authoritative life-state inputs may still produce');
    expect(qaDetail.text).toContain('Active legacy limits may coexist');
    const engineerDetail = await engineerAgent.get(`/library/life-limit-governance/proposals/${id}`).set('x-test-actor', 'engineer');
    expect(engineerDetail.text).not.toContain(`/library/life-limit-governance/publications/${publicationId.id}/activate`);
    for (const denied of ['engineer','supervisor','planner','mechanic','viewer','referenceAdmin','referenceEditor','referenceViewer','custom']) {
      const deniedAgent = request.agent(app());
      const deniedResponse = await deniedAgent.post(`/library/life-limit-governance/publications/${publicationId.id}/activate`).set('x-test-actor', denied).type('form').send({ _csrf: activationToken, proposal_id: id, activation_reason: 'crafted', activation_confirmed: 'true' });
      expect(deniedResponse.status, denied).toBe(403);
    }
    expect((await qaAgent.post(`/library/life-limit-governance/publications/${publicationId.id}/activate`).set('x-test-actor', 'qa').type('form').send({ proposal_id: id, activation_reason: 'missing csrf', activation_confirmed: 'true' })).status).toBe(403);
    expect((await qaAgent.post(`/library/life-limit-governance/publications/${publicationId.id}/activate`).set('x-test-actor', 'qa').type('form').send({ _csrf: activationToken, proposal_id: id, activation_reason: 'QA release after approval', activation_confirmed: 'true' })).status).toBe(302);
    const [activePublication] = await sequelize.query<any>(`SELECT p.publication_state,p.activated_by,l.is_active FROM component_life_limit_publications p JOIN component_life_limits l ON l.id=p.component_life_limit_id WHERE p.id=:id`, { replacements: { id: publicationId.id }, type: QueryTypes.SELECT });
    expect(activePublication).toMatchObject({ publication_state: 'ACTIVE', activated_by: actors.qa!.id, is_active: true });

    const adminProposal = await createProposal(adminAgent, 'admin');
    const adminToken = await csrfFor(adminAgent, 'admin', `/library/life-limit-governance/proposals/${adminProposal}`);
    await adminAgent.post(`/library/life-limit-governance/proposals/${adminProposal}/approve`).set('x-test-actor', 'admin').type('form').send({ _csrf: adminToken, decision_reason: 'self', evidence_confirmed: 'true' });
    const selfDecisionDetail = await adminAgent.get(`/library/life-limit-governance/proposals/${adminProposal}`).set('x-test-actor', 'admin');
    expect(selfDecisionDetail.text).toContain('role="alert"');
    expect(selfDecisionDetail.text).toContain('Independent approval is mandatory; proposers cannot decide their own proposals.');
    expect(selfDecisionDetail.text).not.toMatch(/permission denied|transition_gate|Sequelize|SQLSTATE/i);
    const [stillProposed] = await sequelize.query<any>(`SELECT status FROM component_life_limit_proposals WHERE id=:id;`, { replacements: { id: adminProposal }, type: QueryTypes.SELECT });
    expect(stillProposed.status).toBe('PROPOSED');
    const other = request.agent(app());
    const otherToken = await csrfFor(other, 'otherAdmin', `/library/life-limit-governance/proposals/${adminProposal}`);
    await other.post(`/library/life-limit-governance/proposals/${adminProposal}/approve`).set('x-test-actor', 'otherAdmin').type('form').send({ _csrf: otherToken, decision_reason: 'Independent ADMIN approval', evidence_confirmed: 'true' });
    const [approved] = await sequelize.query<any>(`SELECT status FROM component_life_limit_proposals WHERE id=:id;`, { replacements: { id: adminProposal }, type: QueryTypes.SELECT });
    expect(approved.status).toBe('APPROVED');

    const qaApprovalTarget = await createProposal(request.agent(app()), 'admin');
    const qaApprovalToken = await csrfFor(qaAgent, 'qa', `/library/life-limit-governance/proposals/${qaApprovalTarget}`);
    await qaAgent.post(`/library/life-limit-governance/proposals/${qaApprovalTarget}/approve`).set('x-test-actor', 'qa').type('form').send({ _csrf: qaApprovalToken, decision_reason: 'QA independently approves ADMIN proposal', evidence_confirmed: 'true' });
    const [qaApproved] = await sequelize.query<any>(`SELECT status FROM component_life_limit_proposals WHERE id=:id;`, { replacements: { id: qaApprovalTarget }, type: QueryTypes.SELECT });
    expect(qaApproved.status).toBe('APPROVED');
    const [adminPublication] = await sequelize.query<any>(`SELECT id FROM component_life_limit_publications WHERE proposal_id=:id`, { replacements: { id: qaApprovalTarget }, type: QueryTypes.SELECT });
    const proposerDetail = await adminAgent.get(`/library/life-limit-governance/proposals/${qaApprovalTarget}`).set('x-test-actor', 'admin');
    expect(proposerDetail.text).not.toContain(`/library/life-limit-governance/publications/${adminPublication.id}/activate`);
    const proposerToken = token(proposerDetail.text);
    await adminAgent.post(`/library/life-limit-governance/publications/${adminPublication.id}/activate`).set('x-test-actor', 'admin').type('form').send({ _csrf: proposerToken, proposal_id: qaApprovalTarget, activation_reason: 'ADMIN self bypass attempt', activation_confirmed: 'true' });
    const [stillDormant] = await sequelize.query<any>(`SELECT publication_state,activated_by FROM component_life_limit_publications WHERE id=:id`, { replacements: { id: adminPublication.id }, type: QueryTypes.SELECT });
    expect(stillDormant).toMatchObject({ publication_state: 'DORMANT', activated_by: null });
    const independentDetail = await other.get(`/library/life-limit-governance/proposals/${qaApprovalTarget}`).set('x-test-actor', 'otherAdmin');
    expect(independentDetail.text).toContain(`/library/life-limit-governance/publications/${adminPublication.id}/activate`);
    await other.post(`/library/life-limit-governance/publications/${adminPublication.id}/activate`).set('x-test-actor', 'otherAdmin').type('form').send({ _csrf: token(independentDetail.text), proposal_id: qaApprovalTarget, activation_reason: 'Independent ADMIN activation', activation_confirmed: 'true' });
    const renderedActive = await other.get(`/library/life-limit-governance/proposals/${qaApprovalTarget}`).set('x-test-actor', 'otherAdmin');
    expect(renderedActive.text).toContain('Independent ADMIN activation');
    expect(renderedActive.text).toContain('PUBLICATION_ACTIVATED');
  });

  it('uses governed replacement and withdrawal proposals and refuses stale decisions', async () => {
    const engineer = request.agent(app());
    const qa = request.agent(app());
    const original = await createProposal(engineer, 'engineer');
    let csrfToken = await csrfFor(qa, 'qa', `/library/life-limit-governance/proposals/${original}`);
    await qa.post(`/library/life-limit-governance/proposals/${original}/approve`).set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, decision_reason: 'Approve original', evidence_confirmed: 'true' });

    csrfToken = await csrfFor(engineer, 'engineer', `/library/life-limit-governance/proposals/${original}/replacement/new`);
    const replacementResponse = await engineer.post(`/library/life-limit-governance/proposals/${original}/replacement`).set('x-test-actor', 'engineer').type('form').send({ ...validBody('TBO_HOURS', '125'), _csrf: csrfToken });
    expect(replacementResponse.status).toBe(302);
    const replacement = replacementResponse.headers.location.split('/').pop()!;
    csrfToken = await csrfFor(qa, 'qa', `/library/life-limit-governance/proposals/${replacement}`);
    await qa.post(`/library/life-limit-governance/proposals/${replacement}/approve`).set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, decision_reason: 'Approve replacement', evidence_confirmed: 'true' });

    csrfToken = await csrfFor(engineer, 'engineer', `/library/life-limit-governance/proposals/${replacement}/withdrawal/new`);
    const withdrawalResponse = await engineer.post(`/library/life-limit-governance/proposals/${replacement}/withdrawal`).set('x-test-actor', 'engineer').type('form').send({ ...validBody(), _csrf: csrfToken });
    expect(withdrawalResponse.status).toBe(302);
    const withdrawal = withdrawalResponse.headers.location.split('/').pop()!;
    csrfToken = await csrfFor(qa, 'qa', `/library/life-limit-governance/proposals/${withdrawal}`);
    await qa.post(`/library/life-limit-governance/proposals/${withdrawal}/approve`).set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, decision_reason: 'Approve withdrawal', evidence_confirmed: 'true' });
    const rows = await sequelize.query<any>(`SELECT id,status,lineage_id FROM component_life_limit_proposals WHERE id IN (:ids) ORDER BY revision_number;`, { replacements: { ids: [original, replacement, withdrawal] }, type: QueryTypes.SELECT });
    expect(rows.map(({ status }) => status)).toEqual(['SUPERSEDED', 'WITHDRAWN', 'APPROVED']);
    expect(new Set(rows.map(({ lineage_id }) => lineage_id)).size).toBe(1);

    const rejected = await createProposal(engineer, 'engineer');
    csrfToken = await csrfFor(qa, 'qa', `/library/life-limit-governance/proposals/${rejected}`);
    await qa.post(`/library/life-limit-governance/proposals/${rejected}/reject`).set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, decision_reason: 'Reject evidence' });
    await qa.post(`/library/life-limit-governance/proposals/${rejected}/approve`).set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, decision_reason: 'Stale approval', evidence_confirmed: 'true' });
    const [stillRejected] = await sequelize.query<any>(`SELECT status FROM component_life_limit_proposals WHERE id=:id;`, { replacements: { id: rejected }, type: QueryTypes.SELECT });
    expect(stillRejected.status).toBe('REJECTED');
  });

  it.each([
    [{ limit_type: 'ON_CONDITION' }, 'Select an approved limit type'],
    [{ limit_value: '0' }, 'positive limit value'],
    [{ limit_value: 'NaN' }, 'positive limit value'],
    [{ limit_value: '100000000.00' }, 'positive limit value'],
    [{ source_effective_date: '2026-02-30' }, 'valid authority effective date'],
    [{ evidence_summary: '   ' }, 'required evidence summary'],
    [{ source_reference: '   ' }, 'required source reference'],
    [{ proposal_reason: '   ' }, 'required proposal reason'],
    [{ component_model_id: 'not-a-uuid' }, 'valid component model'],
    [{ component_model_id: randomUUID() }, 'existing active component model'],
    [{ applicability_scope: 'SERIAL_RANGE' }, 'ALL_SERIALS_OF_MODEL'],
    [{ basis: 'SINCE_NEW' }, 'Workflow-controlled fields'],
    [{ status: 'APPROVED' }, 'Workflow-controlled fields'],
  ])('rejects invalid crafted input safely %#', async (override, expected) => {
    const agent = request.agent(app());
    const csrfToken = await csrfFor(agent, 'engineer');
    const response = await agent.post('/library/life-limit-governance/proposals').set('x-test-actor', 'engineer').type('form').send({ ...validBody(), ...override, _csrf: csrfToken });
    expect(response.status).toBe(422);
    expect(response.text).toContain(expected);
    expect(response.text).not.toMatch(/component_life_limit|constraint|Sequelize|SQLSTATE/i);
  });

  it('returns safe 404s and renders complete escaped governance history', async () => {
    const agent = request.agent(app());
    expect((await agent.get('/library/life-limit-governance/proposals/not-a-uuid').set('x-test-actor', 'qa')).status).toBe(404);
    expect((await agent.get(`/library/life-limit-governance/proposals/${randomUUID()}`).set('x-test-actor', 'qa')).status).toBe(404);
    const id = await createProposal(agent, 'admin');
    const detail = await agent.get(`/library/life-limit-governance/proposals/${id}`).set('x-test-actor', 'admin');
    expect(detail.status).toBe(200);
    expect(detail.text).toContain('Proposal reason');
    expect(detail.text).toContain('Recorded:');
    expect(detail.text).toContain('evidence confirmed:');
    expect(detail.text).toContain('Before snapshot');
    expect(detail.text).toContain('After snapshot');
    expect(detail.text).toContain('LEGACY_UNREVIEWED');
  });

  it('returns safe activation 404s, friendly stale handling, and redacts unexpected internals', async () => {
    const qa = request.agent(app());
    const proposalId = await createProposal(request.agent(app()), 'engineer');
    const csrfToken = await csrfFor(qa, 'qa', `/library/life-limit-governance/proposals/${proposalId}`);
    expect((await qa.post('/library/life-limit-governance/publications/not-a-uuid/activate').set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, proposal_id: randomUUID(), activation_reason: 'invalid', activation_confirmed: 'true' })).status).toBe(404);
    expect((await qa.post(`/library/life-limit-governance/publications/${randomUUID()}/activate`).set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, proposal_id: randomUUID(), activation_reason: 'missing', activation_confirmed: 'true' })).status).toBe(404);
    const [stale] = await sequelize.query<any>(`SELECT pub.id,pub.proposal_id FROM component_life_limit_publications pub JOIN component_life_limit_proposals p ON p.id=pub.proposal_id WHERE p.component_model_id=:model AND pub.publication_state='ACTIVE' LIMIT 1`, { replacements: { model: modelId }, type: QueryTypes.SELECT });
    const staleResponse = await qa.post(`/library/life-limit-governance/publications/${stale.id}/activate`).set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, proposal_id: stale.proposal_id, activation_reason: 'stale retry', activation_confirmed: 'true' });
    expect(staleResponse.status).toBe(302);
    expect(`${staleResponse.text} ${staleResponse.headers.location}`).not.toMatch(/Sequelize|SQLSTATE|constraint|component_life_limits|stack/i);
    const spy = vi.spyOn(ComponentLifeLimitGovernanceService, 'activate').mockRejectedValueOnce(new Error('Sequelize SQLSTATE constraint component_life_limits secret stack'));
    const response = await qa.post(`/library/life-limit-governance/publications/${randomUUID()}/activate`).set('x-test-actor', 'qa').type('form').send({ _csrf: csrfToken, proposal_id: randomUUID(), activation_reason: 'forced failure', activation_confirmed: 'true' });
    expect(response.status).toBe(302);
    expect(`${response.text} ${response.headers.location}`).not.toMatch(/Sequelize|SQLSTATE|constraint|component_life_limits|stack/i);
    spy.mockRestore();
  });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`ALTER TABLE public.component_life_limit_governance_history DISABLE TRIGGER tr_cllg_history_protect; ALTER TABLE public.component_life_limit_publications DISABLE TRIGGER tr_cllg_publication_protect; ALTER TABLE public.component_life_limit_proposals DISABLE TRIGGER tr_cllg_proposal_protect;`, { transaction });
    const proposals = await sequelize.query<{ id: string }>(`SELECT id FROM component_life_limit_proposals WHERE component_model_id=:model`, { replacements: { model: modelId }, type: QueryTypes.SELECT, transaction });
    const ids = proposals.map(({ id }) => id);
    if (ids.length) {
      await sequelize.query(`DELETE FROM component_life_limit_governance_history WHERE proposal_id IN (:ids)`, { replacements: { ids }, transaction });
      const limits = await sequelize.query<{ id: string }>(`SELECT component_life_limit_id AS id FROM component_life_limit_publications WHERE proposal_id IN (:ids)`, { replacements: { ids }, type: QueryTypes.SELECT, transaction });
      await sequelize.query(`DELETE FROM component_life_limit_publications WHERE proposal_id IN (:ids); DELETE FROM component_life_limit_proposals WHERE id IN (:ids)`, { replacements: { ids }, transaction });
      if (limits.length) await sequelize.query(`DELETE FROM component_life_limits WHERE id IN (:ids)`, { replacements: { ids: limits.map(({ id }) => id) }, transaction });
    }
    await sequelize.query(`DELETE FROM user_roles WHERE user_id IN (:users); DELETE FROM users WHERE id IN (:users); DELETE FROM component_models WHERE id=:model; DELETE FROM manufacturers WHERE id=:manufacturer; DELETE FROM rf_asset_type WHERE id=:asset`, { replacements: { users: ownedUserIds, model: modelId, manufacturer: manufacturerId, asset: assetId }, transaction });
    await sequelize.query(`ALTER TABLE public.component_life_limit_governance_history ENABLE TRIGGER tr_cllg_history_protect; ALTER TABLE public.component_life_limit_publications ENABLE TRIGGER tr_cllg_publication_protect; ALTER TABLE public.component_life_limit_proposals ENABLE TRIGGER tr_cllg_proposal_protect;`, { transaction });
  });
  const [remaining] = await sequelize.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM users WHERE id IN (:users)`, { replacements: { users: ownedUserIds }, type: QueryTypes.SELECT });
  expect(remaining!.count).toBe(0);
  await sequelize.close();
});
