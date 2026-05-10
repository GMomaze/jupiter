import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { CustomerUser } from '../../models/CustomerUser.js';
import { hashPassword, verifyPassword } from '../auth/password.util.js';

const router = Router();
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function wantsJson(req: any) {
  return req.headers.accept?.includes('application/json');
}

function respondLoginFailure(req: any, res: any, message: string) {
  if (wantsJson(req)) {
    return res.status(401).json({ error: message });
  }

  req.flash('error', message);
  return res.redirect('/customer-auth/login');
}

function finishCustomerLogout(req: any, res: any) {
  if (wantsJson(req)) {
    return res.status(200).json({ success: true });
  }

  return res.redirect('/customer-auth/login');
}

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function generateResetToken() {
  return randomBytes(32).toString('hex');
}

function renderResetRequestResult(
  req: any,
  res: any,
  resetToken?: string
) {
  if (wantsJson(req)) {
    const body: Record<string, unknown> = { success: true };

    if (process.env.NODE_ENV === 'test' && resetToken) {
      body.resetToken = resetToken;
    }

    return res.status(200).json(body);
  }

  req.flash(
    'success',
    'If that account is eligible, password reset instructions have been prepared.'
  );
  return res.redirect('/customer-auth/reset-password');
}

function respondResetRequestFailure(req: any, res: any, message: string) {
  if (wantsJson(req)) {
    return res.status(400).json({ error: message });
  }

  req.flash('error', message);
  return res.redirect('/customer-auth/reset-password');
}

function respondResetCompletionFailure(
  req: any,
  res: any,
  token: string,
  message: string,
  statusCode = 400
) {
  if (wantsJson(req)) {
    return res.status(statusCode).json({ error: message });
  }

  req.flash('error', message);

  if (token) {
    return res.redirect(
      `/customer-auth/reset-password/complete?token=${encodeURIComponent(token)}`
    );
  }

  return res.redirect('/customer-auth/reset-password');
}

router.get('/login', (req, res) => {
  if (req.session?.customerUser) {
    return res.redirect('/customer-portal');
  }

  res.render('customer-auth/login');
});

router.get('/reset-password', (_req, res) => {
  res.render('customer-auth/reset-password-request');
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) {
      return respondResetRequestFailure(req, res, 'Email is required.');
    }

    const customerUser = await CustomerUser.findOne({ where: { email } });
    let resetToken: string | undefined;

    if (customerUser && customerUser.status === 'ACTIVE') {
      resetToken = generateResetToken();
      const tokenHash = hashResetToken(resetToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await customerUser.update({
        password_reset_token_hash: tokenHash,
        password_reset_expires_at: expiresAt,
      });
    }

    return renderResetRequestResult(req, res, resetToken);
  } catch (err) {
    return next(err);
  }
});

router.get('/reset-password/complete', (req, res) => {
  const token = String(req.query?.token || '').trim();

  if (!token) {
    req.flash('error', 'Reset link is invalid or has expired.');
    return res.redirect('/customer-auth/reset-password');
  }

  return res.render('customer-auth/reset-password-complete', { token });
});

router.post('/reset-password/complete', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirm_password || '');

    if (!token) {
      return respondResetCompletionFailure(
        req,
        res,
        token,
        'Reset link is invalid or has expired.'
      );
    }

    if (!password || !confirmPassword) {
      return respondResetCompletionFailure(
        req,
        res,
        token,
        'Password and confirmation are required.'
      );
    }

    if (password !== confirmPassword) {
      return respondResetCompletionFailure(
        req,
        res,
        token,
        'Password confirmation does not match.'
      );
    }

    const tokenHash = hashResetToken(token);
    const customerUser = await CustomerUser.findOne({
      where: {
        password_reset_token_hash: tokenHash,
        status: 'ACTIVE',
      },
    });

    const expiresAt = customerUser?.password_reset_expires_at || null;
    const isExpired =
      !expiresAt || Number.isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() < Date.now();

    if (!customerUser || isExpired) {
      return respondResetCompletionFailure(
        req,
        res,
        token,
        'Reset link is invalid or has expired.',
        400
      );
    }

    const passwordHash = await hashPassword(password);

    await customerUser.update({
      password_hash: passwordHash,
      password_reset_token_hash: null,
      password_reset_expires_at: null,
    });

    if (wantsJson(req)) {
      return res.status(200).json({ success: true });
    }

    req.flash(
      'success',
      'Password reset completed. You may now sign in with your new password.'
    );
    return res.redirect('/customer-auth/login');
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return respondLoginFailure(req, res, 'Email and password are required.');
    }

    const customerUser = await CustomerUser.findOne({ where: { email } });

    if (!customerUser || !customerUser.password_hash) {
      return respondLoginFailure(req, res, 'Invalid credentials.');
    }

    if (customerUser.status !== 'ACTIVE') {
      return respondLoginFailure(req, res, 'Account is not active.');
    }

    const isValid = await verifyPassword(customerUser.password_hash, password);
    if (!isValid) {
      return respondLoginFailure(req, res, 'Invalid credentials.');
    }

    if (!req.session || typeof req.session.save !== 'function') {
      return next(new Error('Session unavailable for customer login.'));
    }

    req.session.customerUser = {
      id: customerUser.id,
      customer_id: customerUser.customer_id,
      email: customerUser.email,
      display_name: customerUser.display_name,
    };

    req.session.lastActivity = Date.now();

    await customerUser.update({ last_login_at: new Date() });

    req.session.save((saveErr: any) => {
      if (saveErr) return next(saveErr);

      if (wantsJson(req)) {
        return res.status(200).json({ success: true });
      }

      return res.redirect('/customer-portal');
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (req, res, next) => {
  if (!req.session) {
    res.clearCookie('jupiter.sid');
    return finishCustomerLogout(req, res);
  }

  delete req.session.customerUser;

  if (typeof req.session.save === 'function') {
    return req.session.save((err: any) => {
      if (err) return next(err);
      return finishCustomerLogout(req, res);
    });
  }

  return finishCustomerLogout(req, res);
});

export default router;
