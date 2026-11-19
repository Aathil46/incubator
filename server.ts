import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { SessionUser } from './src/shared/types.ts';
import {
  computeDashboardSummary,
  deriveAccessControlState,
  evaluateAccessAttempt,
  filterAccessLogs,
} from './server/accessLogic.ts';
import { createDatabaseStore } from './server/db.ts';
import {
  createSessionToken,
  validateEmployeeInput,
  verifySessionToken,
} from './server/security.ts';

const PORT = Number(process.env.PORT ?? 3000);
const SESSION_COOKIE = 'incubator_session';
const SESSION_SECRET: string =
  process.env.SESSION_SECRET ??
  (() => {
    throw new Error('SESSION_SECRET must be configured on the server.');
  })();

const db = createDatabaseStore();
let simulationOverriddenLocked = false;

const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const WEBAUTHN_RP_ID =
  process.env.WEBAUTHN_RP_ID ||
  (() => {
    try {
      return new URL(APP_URL).hostname;
    } catch {
      return 'localhost';
    }
  })();
const WEBAUTHN_ORIGINS = (
  process.env.WEBAUTHN_ORIGINS ||
  APP_URL
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

interface PendingWebAuthnChallenge {
  challenge: string;
  employeeId?: string;
  expiresAt: number;
}
const pendingWebAuthnChallenges = new Map<string, PendingWebAuthnChallenge>();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

async function resolveSessionUser(req: Request): Promise<SessionUser | null> {
  const cookies = parseCookies(req.headers.cookie);
  const payload = verifySessionToken(cookies[SESSION_COOKIE], SESSION_SECRET);
  if (!payload) return null;

  const employee = await db.findEmployeeById(payload.id);
  if (!employee || !employee.is_active) {
    return null;
  }

  return {
    id: employee.id,
    employee_id: employee.employee_id,
    full_name: employee.full_name,
    role: employee.role,
  };
}

function requireAuthenticated(req: Request, res: Response, next: NextFunction): void {
  resolveSessionUser(req)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      (req as Request & { sessionUser?: SessionUser }).sessionUser = user;
      next();
    })
    .catch((err) => next(err));
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  resolveSessionUser(req)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: 'Authentication required. Please sign in as an Administrator.' });
        return;
      }
      if (user.role !== 'Admin') {
        res.status(403).json({
          error: 'Forbidden: Administrator role is required to perform this operation.',
        });
        return;
      }
      (req as Request & { sessionUser?: SessionUser }).sessionUser = user;
      next();
    })
    .catch((err) => next(err));
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    if (!/^https:\/\//.test(APP_URL)) {
      throw new Error('APP_URL must use HTTPS in production for WebAuthn passkeys.');
    }
    if (WEBAUTHN_ORIGINS.some((origin) => !/^https:\/\//.test(origin))) {
      throw new Error('WEBAUTHN_ORIGINS must contain HTTPS origins in production.');
    }
  }
  await db.ensureSeeded();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, database: db.mode });
  });

  app.get('/api/auth/session', async (req, res, next) => {
    try {
      const user = await resolveSessionUser(req);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/webauthn/passkeys', requireAuthenticated, async (req, res, next) => {
    try {
      const sessionUser = (req as Request & { sessionUser?: SessionUser }).sessionUser!;
      const passkeys = await db.listPasskeys(sessionUser.id);
      res.json({ passkeys });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/webauthn/registration/options', requireAuthenticated, async (req, res, next) => {
    try {
      const sessionUser = (req as Request & { sessionUser?: SessionUser }).sessionUser!;
      const employee = await db.findEmployeeById(sessionUser.id);
      if (!employee || !employee.is_active) {
        res.status(403).json({ error: 'Only active employees can register passkeys.' });
        return;
      }

      const existing = await db.listPasskeys(employee.id);
      const options = await generateRegistrationOptions({
        rpName: 'Smart Incubator Room',
        rpID: WEBAUTHN_RP_ID,
        userName: employee.employee_id,
        userDisplayName: employee.full_name,
        userID: new Uint8Array(Buffer.from(employee.id)),
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required',
          authenticatorAttachment: 'platform',
        },
        excludeCredentials: existing.map((passkey) => ({
          id: passkey.credential_id,
          transports: passkey.transports as never[],
        })),
      });

      pendingWebAuthnChallenges.set(options.challenge, {
        challenge: options.challenge,
        employeeId: employee.id,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      res.json({ options });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/webauthn/registration/verify', requireAuthenticated, async (req, res, next) => {
    try {
      const sessionUser = (req as Request & { sessionUser?: SessionUser }).sessionUser!;
      const challenge = typeof req.body?.challenge === 'string' ? req.body.challenge : '';
      const response = req.body?.response as RegistrationResponseJSON | undefined;
      const pending = pendingWebAuthnChallenges.get(challenge);

      if (!challenge || !pending || pending.expiresAt < Date.now() || pending.employeeId !== sessionUser.id) {
        res.status(400).json({ error: 'The passkey registration challenge is missing or expired.' });
        return;
      }
      pendingWebAuthnChallenges.delete(challenge);

      if (!response) {
        res.status(400).json({ error: 'Passkey registration response is missing.' });
        return;
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: pending.challenge,
          expectedOrigin: WEBAUTHN_ORIGINS,
          expectedRPID: WEBAUTHN_RP_ID,
          requireUserVerification: true,
        });
      } catch {
        res.status(400).json({ error: 'The passkey registration response is invalid.' });
        return;
      }

      if (!verification.verified) {
        res.status(400).json({ error: 'Passkey registration could not be verified.' });
        return;
      }

      const credential = verification.registrationInfo.credential;
      const passkey = await db.storePasskey({
        employee_id: sessionUser.id,
        credential_id: credential.id,
        public_key: isoBase64URL.fromBuffer(credential.publicKey),
        counter: credential.counter,
        transports: response.response.transports ?? credential.transports ?? [],
        device_name: 'Android passkey',
        backup_eligible: verification.registrationInfo.credentialDeviceType === 'multiDevice',
        backup_state: verification.registrationInfo.credentialBackedUp,
      });
      res.status(201).json({ passkey });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/webauthn/passkeys/:credentialId', requireAuthenticated, async (req, res, next) => {
    try {
      const sessionUser = (req as Request & { sessionUser?: SessionUser }).sessionUser!;
      const credentialId = String(req.params.credentialId ?? '');
      const deleted = await db.deletePasskey(sessionUser.id, credentialId);
      if (!deleted) {
        res.status(404).json({ error: 'Passkey not found.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/webauthn/authentication/options', async (_req, res, next) => {
    try {
      const options = await generateAuthenticationOptions({
        rpID: WEBAUTHN_RP_ID,
        timeout: 60_000,
        userVerification: 'required',
      });
      pendingWebAuthnChallenges.set(options.challenge, {
        challenge: options.challenge,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      res.json({ options });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/webauthn/authentication/failed', async (req, res, next) => {
    try {
      const reason =
        typeof req.body?.reason === 'string'
          ? req.body.reason.slice(0, 200)
          : 'Passkey authentication cancelled or failed';
      await db.createAccessLog({
        employee_ref: null,
        employee_id: 'UNKNOWN',
        employee_name: 'Unknown passkey attempt',
        role: 'Unknown',
        status: 'Denied',
        reason,
        auth_method: 'Passkey',
      });
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/webauthn/authentication/verify', async (req, res, next) => {
    try {
      const challenge = typeof req.body?.challenge === 'string' ? req.body.challenge : '';
      const response = req.body?.response as AuthenticationResponseJSON | undefined;
      const pending = pendingWebAuthnChallenges.get(challenge);

      if (!challenge || !pending || pending.expiresAt < Date.now()) {
        res.status(400).json({ error: 'The fingerprint challenge is missing or expired.' });
        return;
      }
      pendingWebAuthnChallenges.delete(challenge);
      if (!response) {
        res.status(400).json({ error: 'Fingerprint authentication response is missing.' });
        return;
      }

      const passkey = await db.findPasskeyByCredentialId(response.id);
      if (!passkey) {
        await db.createAccessLog({
          employee_ref: null,
          employee_id: 'UNKNOWN',
          employee_name: 'Unknown passkey',
          role: 'Unknown',
          status: 'Denied',
          reason: 'Passkey credential not recognized',
          auth_method: 'Passkey',
        });
        res.status(401).json({ authenticated: false, message: 'Passkey is not registered for any active employee.' });
        return;
      }

      const employee = await db.findEmployeeById(passkey.employee_id);
      if (!employee || !employee.is_active) {
        await db.createAccessLog({
          employee_ref: employee?.id ?? passkey.employee_id,
          employee_id: employee?.employee_id ?? 'UNKNOWN',
          employee_name: employee?.full_name ?? 'Inactive employee',
          role: employee?.role ?? 'Unknown',
          status: 'Denied',
          reason: 'Account inactive',
          auth_method: 'Passkey',
        });
        res.status(403).json({ authenticated: false, message: 'This employee account is inactive.' });
        return;
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: pending.challenge,
          expectedOrigin: WEBAUTHN_ORIGINS,
          expectedRPID: WEBAUTHN_RP_ID,
          credential: {
            id: passkey.credential_id,
            publicKey: isoBase64URL.toBuffer(passkey.public_key),
            counter: passkey.counter,
            transports: passkey.transports as never[],
          },
          requireUserVerification: true,
        });
      } catch {
        await db.createAccessLog({
          employee_ref: employee.id,
          employee_id: employee.employee_id,
          employee_name: employee.full_name,
          role: employee.role,
          status: 'Denied',
          reason: 'Invalid passkey authentication response',
          auth_method: 'Passkey',
        });
        res.status(400).json({ authenticated: false, message: 'Invalid fingerprint authentication response.' });
        return;
      }

      if (!verification.verified) {
        await db.createAccessLog({
          employee_ref: employee.id,
          employee_id: employee.employee_id,
          employee_name: employee.full_name,
          role: employee.role,
          status: 'Denied',
          reason: 'Passkey verification failed',
          auth_method: 'Passkey',
        });
        res.status(401).json({ authenticated: false, message: 'Fingerprint verification failed.' });
        return;
      }

      await db.updatePasskeyCounter(passkey.credential_id, verification.authenticationInfo.newCounter);
      await db.createAccessLog({
        employee_ref: employee.id,
        employee_id: employee.employee_id,
        employee_name: employee.full_name,
        role: employee.role,
        status: 'Granted',
        reason: 'Passkey and device biometric verification succeeded',
        auth_method: 'Passkey',
      });

      simulationOverriddenLocked = false;
      const sessionUser: SessionUser = {
        id: employee.id,
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        role: employee.role,
      };
      setSessionCookie(res, createSessionToken(sessionUser, SESSION_SECRET));
      res.json({
        authenticated: true,
        message: 'Fingerprint authentication succeeded.',
        user: sessionUser,
        decision: 'GRANTED',
        doorStatus: 'UNLOCKED',
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/employees/active', requireAuthenticated, async (_req, res, next) => {
    try {
      const employees = await db.listActiveEmployees();
      res.json({ employees });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const rawEmployeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId.trim() : '';
      const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!rawEmployeeId || !rawPassword) {
        res.status(400).json({ error: 'Employee ID and password are required.' });
        return;
      }

      const normalizedId = rawEmployeeId.toUpperCase();
      const employee = await db.findEmployeeByEmployeeId(normalizedId);
      const evaluation = evaluateAccessAttempt(employee, rawPassword);

      if (evaluation.granted) {
        simulationOverriddenLocked = false;
      }

      const log = await db.createAccessLog({
        employee_ref: employee ? employee.id : null,
        employee_id: employee ? employee.employee_id : normalizedId,
        employee_name: employee ? employee.full_name : 'Unregistered ID',
        role: employee ? employee.role : 'Unknown',
        status: evaluation.status,
        reason: evaluation.reason,
        auth_method: 'Password',
      });

      if (!evaluation.granted || !employee) {
        res.status(evaluation.httpStatus).json({
          authenticated: false,
          message: evaluation.clientMessage,
          decision: evaluation.decision,
          doorStatus: evaluation.doorStatus,
          log,
        });
        return;
      }

      const sessionUser: SessionUser = {
        id: employee.id,
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        role: employee.role,
      };
      const token = createSessionToken(sessionUser, SESSION_SECRET);
      setSessionCookie(res, token);

      res.status(200).json({
        authenticated: true,
        message: evaluation.clientMessage,
        user: sessionUser,
        decision: evaluation.decision,
        doorStatus: evaluation.doorStatus,
        log,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/dashboard', requireAuthenticated, async (_req, res, next) => {
    try {
      const [employees, logs] = await Promise.all([
        db.listAllEmployees(),
        db.listAccessLogs(),
      ]);
      const summary = computeDashboardSummary(employees, logs);
      res.json({ summary, databaseMode: db.mode });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/access-control', requireAuthenticated, async (_req, res, next) => {
    try {
      const latestLog = await db.getLatestAccessLog();
      const state = deriveAccessControlState(latestLog, simulationOverriddenLocked);
      res.json({ state });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/access-control/lock', requireAdmin, async (_req, res, next) => {
    try {
      simulationOverriddenLocked = true;
      const latestLog = await db.getLatestAccessLog();
      const state = deriveAccessControlState(latestLog, simulationOverriddenLocked);
      res.json({ state });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/logs', requireAdmin, async (req, res, next) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const status = typeof req.query.status === 'string' ? req.query.status : 'All';
      const allLogs = await db.listAccessLogs();
      const logs = filterAccessLogs(allLogs, { search, status });
      res.json({ logs, total: allLogs.length });
    } catch (err) {
      next(err);
    }
  });

  // Admin-only routes
  app.delete('/api/logs/:id', requireAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      const deleted = await db.deleteAccessLog(id);
      if (!deleted) {
        res.status(404).json({ error: 'Access log record not found.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/logs', requireAdmin, async (_req, res, next) => {
    try {
      const removed = await db.clearAccessLogs();
      res.json({ ok: true, removed });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/admin/employees', requireAdmin, async (_req, res, next) => {
    try {
      const employees = await db.listAllEmployees();
      res.json({ employees });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/employees', requireAdmin, async (req, res, next) => {
    try {
      const validation = validateEmployeeInput(req.body ?? {}, { requirePassword: true });
      if (!validation.valid || !validation.normalized || !validation.normalized.password) {
        res.status(400).json({ error: validation.errors.join(' ') });
        return;
      }

      const created = await db.createEmployee({
        employee_id: validation.normalized.employee_id,
        full_name: validation.normalized.full_name,
        role: validation.normalized.role,
        password: validation.normalized.password,
        is_active: validation.normalized.is_active,
      });

      res.status(201).json({ employee: created });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/admin/employees/:id', requireAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      const sessionUser = (req as Request & { sessionUser?: SessionUser }).sessionUser;
      const validation = validateEmployeeInput(req.body ?? {}, { requirePassword: false });
      if (!validation.valid || !validation.normalized) {
        res.status(400).json({ error: validation.errors.join(' ') });
        return;
      }

      if (sessionUser && sessionUser.id === id) {
        if (validation.normalized.role !== 'Admin') {
          res.status(400).json({
            error: 'You cannot remove Admin privileges from your own active account.',
          });
          return;
        }
        if (!validation.normalized.is_active) {
          res.status(400).json({
            error: 'You cannot deactivate your own active administrator account.',
          });
          return;
        }
      }

      const updated = await db.updateEmployee(id, {
        employee_id: validation.normalized.employee_id,
        full_name: validation.normalized.full_name,
        role: validation.normalized.role,
        is_active: validation.normalized.is_active,
        password: validation.normalized.password,
      });

      if (!updated) {
        res.status(404).json({ error: 'Employee record not found.' });
        return;
      }

      res.json({ employee: updated });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/admin/employees/:id/status', requireAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      const sessionUser = (req as Request & { sessionUser?: SessionUser }).sessionUser;
      const isActive = Boolean(req.body?.is_active);

      if (sessionUser && sessionUser.id === id && !isActive) {
        res.status(400).json({
          error: 'You cannot deactivate your own active administrator account.',
        });
        return;
      }

      const updated = await db.setEmployeeStatus(id, isActive);
      if (!updated) {
        res.status(404).json({ error: 'Employee record not found.' });
        return;
      }
      res.json({ employee: updated });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/admin/employees/:id', requireAdmin, async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      const sessionUser = (req as Request & { sessionUser?: SessionUser }).sessionUser;

      if (sessionUser && sessionUser.id === id) {
        res.status(400).json({
          error: 'You cannot delete your own active administrator account.',
        });
        return;
      }

      const deleted = await db.deleteEmployee(id);
      if (!deleted) {
        res.status(404).json({ error: 'Employee record not found.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.statusCode ?? 500;
    const message = err.message || 'An unexpected server error occurred.';
    res.status(status).json({ error: message });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Incubator Room server running on http://0.0.0.0:${PORT} (storage: ${db.mode})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
