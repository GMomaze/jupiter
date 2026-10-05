import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ejs from 'ejs';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createStaffInvitationAcceptanceRouter } from './staff-invitation.routes.js';

function app(service: any) {
  const value = express();
  value.use(express.urlencoded({ extended: true }));
  value.use('/auth/staff-invitations', createStaffInvitationAcceptanceRouter(service));
  value.response.render = function (view: string, data: any) {
    return this.status(200).json({ view, data });
  };
  return value;
}

describe('staff invitation acceptance route', () => {
  it('renders the GET acceptance page with a fully-specified view contract (no undefined variables)', async () => {
    const service = {
      describe: async () => ({ valid: true, email: 'admin@example.com', needsPassword: true, tenantId: '60200000-0000-4000-8000-000000000001' }),
    };
    const response = await request(app(service)).get(
      '/auth/staff-invitations/accept?token=' + 't'.repeat(64) + '&tenant=60200000-0000-4000-8000-000000000001',
    );
    expect(response.status).toBe(200);
    expect(response.body.view).toBe('auth/invitation-accept');
    expect(response.body.data.completed).toBe(false);
    expect(response.body.data.awaitingActivation).toBe(false);
    expect(response.body.data.companyName).toBe('');
  });

  it('renders the invitation acceptance view without throwing for a GET request', async () => {
    const tpl = readFileSync(resolve(process.cwd(), 'src/views/auth/invitation-accept.ejs'), 'utf8');
    const locals = {
      title: 'Accept invitation',
      csrfToken: 'x',
      token: 't'.repeat(64),
      tenant: '60200000-0000-4000-8000-000000000001',
      valid: true,
      email: 'admin@example.com',
      needsPassword: true,
      completed: false,
      awaitingActivation: false,
      companyName: '',
      messages: {},
    };
    expect(() => ejs.render(tpl, locals)).not.toThrow();
  });
});
