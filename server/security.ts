import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { EmployeeRole } from '../src/shared/types.ts';
import { EMPLOYEE_ROLES } from '../src/shared/types.ts';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];

  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) {
    return false;
  }

  try {
    const expectedBuffer = Buffer.from(expectedHex, 'hex');
    const derivedBuffer = scryptSync(password, salt, expectedBuffer.length, { N: n, r, p });
    if (derivedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(derivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  id: string;
  employee_id: string;
  full_name: string;
  role: EmployeeRole;
  exp: number;
}

export function createSessionToken(
  user: Omit<SessionPayload, 'exp'>,
  secret: string,
  ttlMs = 8 * 60 * 60 * 1000,
): string {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowMs = Date.now(),
): SessionPayload | null {
  if (!token || !secret) {
    return null;
  }
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) {
    return null;
  }
  const encoded = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);
  if (!encoded || !signature) {
    return null;
  }

  const expectedSig = createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.employee_id !== 'string' ||
      typeof parsed.full_name !== 'string' ||
      !EMPLOYEE_ROLES.includes(parsed.role) ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp <= nowMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface EmployeeValidationInput {
  employee_id: string;
  full_name: string;
  role: string;
  password?: string;
  is_active?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: {
    employee_id: string;
    full_name: string;
    role: EmployeeRole;
    is_active: boolean;
    password?: string;
  };
}

export function validateEmployeeInput(
  input: EmployeeValidationInput,
  options: { requirePassword: boolean },
): ValidationResult {
  const errors: string[] = [];
  const employeeId = (input.employee_id ?? '').trim().toUpperCase();
  const fullName = (input.full_name ?? '').trim();
  const role = (input.role ?? '').trim();
  const password = input.password ?? '';
  const isActive = input.is_active ?? true;

  if (!employeeId) {
    errors.push('Employee ID is required.');
  } else if (!/^[A-Z0-9-]{3,24}$/.test(employeeId)) {
    errors.push('Employee ID must be 3–24 characters using letters, numbers, or hyphens.');
  }

  if (!fullName || fullName.length < 2) {
    errors.push('Full Name must be at least 2 characters.');
  } else if (fullName.length > 80) {
    errors.push('Full Name must be 80 characters or fewer.');
  }

  if (!EMPLOYEE_ROLES.includes(role as EmployeeRole)) {
    errors.push('Role must be Doctor, Nurse, Admin, or Staff.');
  }

  if (options.requirePassword) {
    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters.');
    }
  } else if (password && password.length < 6) {
    errors.push('New password must be at least 6 characters when provided.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    normalized: {
      employee_id: employeeId,
      full_name: fullName,
      role: role as EmployeeRole,
      is_active: Boolean(isActive),
      ...(password ? { password } : {}),
    },
  };
}
