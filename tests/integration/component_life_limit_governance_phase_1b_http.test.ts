import { randomUUID } from 'node:crypto';
import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import csrf from 'csurf';
import request from 'supertest';
import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sequelize from '../../src/config/database.js';
import libraryRoutes from '../../src/modules/library/library.routes.js';

type Actor = { id: string; role: string };
const actors: Record<string, Actor> = {};
let modelId = '';

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
        : actor.role === 'QA' ? [{ code: 'COMPONENT_LIFE_LIMIT_APPROVE' }] : [];
      (req as any).user = { id: actor.id, full_name: actor.role, roles: [{ code: actor.role, permissions }] };
      (req as any).isAuthenticated = () => true;
    } else (req as any).isAuthenticated = () => false;
    res.locals.user = (req as any).user || null;
    res.locals.remoteTestMode = false;
    res.locals.messages = {};
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
  for (const [name, role] of Object.entries({ engineer: 'ENGINEER', qa: 'QA', admin: 'ADMIN', otherAdmin: 'ADMIN', viewer: 'VIEWER' })) {
    const [user] = await sequelize.query<{ id: string }>(
      `INSERT INTO users(email,password_hash,full_name,is_active,created_at,updated_at) VALUES(:email,'test',:name,true,NOW(),NOW()) RETURNING id;`,
      { replacements: { email: `${name}-${key}@test.invalid`, name }, type: QueryTypes.SELECT }
    );
    await sequelize.query(`INSERT INTO user_roles(user_id,role_id) SELECT :user,id FROM rf_role WHERE code=:role;`, { replacements: { user: user!.id, role } });
    actors[name] = { id: user!.id, role };
  }
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
    expect((await qaAgent.post(`/library/life-limit-governance/proposals/${id}/approve`).set('x-test-actor', 'qa').type('form').send({ _csrf: qaToken, decision_reason: 'Independent QA approval', evidence_confirmed: 'true' })).status).toBe(302);
    const [publication] = await sequelize.query<any>(`SELECT p.publication_state,l.is_active FROM component_life_limit_publications p JOIN component_life_limits l ON l.id=p.component_life_limit_id WHERE p.proposal_id=:id;`, { replacements: { id }, type: QueryTypes.SELECT });
    expect(publication).toMatchObject({ publication_state: 'DORMANT', is_active: false });

    const adminProposal = await createProposal(adminAgent, 'admin');
    const adminToken = await csrfFor(adminAgent, 'admin', `/library/life-limit-governance/proposals/${adminProposal}`);
    await adminAgent.post(`/library/life-limit-governance/proposals/${adminProposal}/approve`).set('x-test-actor', 'admin').type('form').send({ _csrf: adminToken, decision_reason: 'self', evidence_confirmed: 'true' });
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
});

afterAll(async () => sequelize.close());
