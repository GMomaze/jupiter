import { Router } from 'express';
import { PlatformUserInvitationService, PLATFORM_USER_INVITATION_UNAVAILABLE } from './platform-user-invitation.js';

export function createPlatformUserInvitationAcceptanceRouter(service: PlatformUserInvitationService) {
  const router = Router();

  router.get('/accept', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const description = await service.describe({ token });
    return res.render('platform/user-accept', {
      title: 'Set up your platform account',
      csrfToken: typeof req.csrfToken === 'function' ? req.csrfToken() : '',
      token,
      valid: description.valid,
      email: description.valid ? description.email : '',
    });
  });

  router.post('/accept', async (req, res) => {
    const wantsJson = (req.headers.accept || '').includes('application/json') ||
      (typeof req.is === 'function' && !!req.is('application/json'));
    const token = req.body?.token;
    const password = req.body?.password;
    try {
      const result = await service.accept({
        token,
        password,
        correlationId: req.headers['x-correlation-id'],
      });
      if (wantsJson) return res.status(200).json(result);
      req.flash('success', 'Your account is ready. Please sign in.');
      return res.redirect('/auth/login');
    } catch (error) {
      if (wantsJson) {
        if (error instanceof Error && error.message === PLATFORM_USER_INVITATION_UNAVAILABLE) {
          return res.status(404).json({ error: 'Invitation unavailable' });
        }
        return res.status(409).json({ error: 'Invitation unavailable' });
      }
      req.flash('error', 'This invitation is invalid, has expired or has already been used.');
      return res.redirect('/platform/users/accept?token=' + encodeURIComponent(String(token ?? '')));
    }
  });

  return router;
}
