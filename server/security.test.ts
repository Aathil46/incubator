import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  hashPassword,
  validateEmployeeInput,
  verifyPassword,
  verifySessionToken,
} from './security';

test('hashPassword and verifyPassword verify valid credentials and reject wrong ones', () => {
  const hash1 = hashPassword('NicuSecure#1');
  const hash2 = hashPassword('NicuSecure#1');

  assert.notEqual(hash1, hash2); // unique random salt per hash
  assert.ok(hash1.startsWith('scrypt$'));
  assert.equal(verifyPassword('NicuSecure#1', hash1), true);
  assert.equal(verifyPassword('WrongPass', hash1), false);
  assert.equal(verifyPassword('', hash1), false);
});

test('createSessionToken and verifySessionToken reject tampered and expired tokens', () => {
  const secret = 'test-session-secret-key';
  const token = createSessionToken(
    {
      id: 'u-1',
      employee_id: 'ADM-001',
      full_name: 'Dr. Elena Rostova',
      role: 'Admin',
    },
    secret,
    60_000,
  );

  const verified = verifySessionToken(token, secret, Date.now());
  assert.ok(verified);
  assert.equal(verified.employee_id, 'ADM-001');
  assert.equal(verified.role, 'Admin');

  const tampered = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifySessionToken(tampered, secret, Date.now()), null);
  assert.equal(verifySessionToken(token, 'wrong-secret', Date.now()), null);
  assert.equal(verifySessionToken(token, secret, Date.now() + 120_000), null);
});

test('validateEmployeeInput enforces ID format, role whitelist, and password rules', () => {
  const validCreate = validateEmployeeInput(
    {
      employee_id: 'doc-205',
      full_name: 'Dr. Priya Nair',
      role: 'Doctor',
      password: 'Password123',
      is_active: true,
    },
    { requirePassword: true },
  );

  assert.equal(validCreate.valid, true);
  assert.equal(validCreate.normalized?.employee_id, 'DOC-205');

  const invalidRole = validateEmployeeInput(
    {
      employee_id: 'DOC-205',
      full_name: 'Dr. Priya Nair',
      role: 'Surgeon',
      password: 'Password123',
    },
    { requirePassword: true },
  );
  assert.equal(invalidRole.valid, false);
  assert.ok(invalidRole.errors.some((e) => e.includes('Role')));

  const optionalPasswordUpdate = validateEmployeeInput(
    {
      employee_id: 'DOC-205',
      full_name: 'Dr. Priya Nair',
      role: 'Doctor',
      is_active: false,
    },
    { requirePassword: false },
  );
  assert.equal(optionalPasswordUpdate.valid, true);
  assert.equal(optionalPasswordUpdate.normalized?.is_active, false);
});
