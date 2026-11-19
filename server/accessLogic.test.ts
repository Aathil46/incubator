import test from 'node:test';
import assert from 'node:assert/strict';
import type { AccessLogEntry, EmployeePublic, EmployeeRecord } from '../src/shared/types';
import {
  computeDashboardSummary,
  deriveAccessControlState,
  evaluateAccessAttempt,
  filterAccessLogs,
} from './accessLogic';
import { hashPassword } from './security';

const activeDoctor: EmployeeRecord = {
  id: 'emp-1',
  employee_id: 'DOC-101',
  full_name: 'Dr. Maya Lin',
  role: 'Doctor',
  password_hash: hashPassword('DoctorPass1!'),
  is_active: true,
  created_at: '2026-11-10T08:00:00.000Z',
  updated_at: '2026-11-10T08:00:00.000Z',
};

const inactiveStaff: EmployeeRecord = {
  id: 'emp-2',
  employee_id: 'STF-104',
  full_name: 'Marcus Vance',
  role: 'Staff',
  password_hash: hashPassword('StaffPass1!'),
  is_active: false,
  created_at: '2026-11-10T08:00:00.000Z',
  updated_at: '2026-11-10T08:00:00.000Z',
};

test('evaluateAccessAttempt enforces active account and valid password', () => {
  const granted = evaluateAccessAttempt(activeDoctor, 'DoctorPass1!');
  assert.equal(granted.granted, true);
  assert.equal(granted.decision, 'GRANTED');
  assert.equal(granted.doorStatus, 'UNLOCKED');
  assert.equal(granted.httpStatus, 200);

  const wrongPw = evaluateAccessAttempt(activeDoctor, 'WrongPassword');
  assert.equal(wrongPw.granted, false);
  assert.equal(wrongPw.decision, 'DENIED');
  assert.equal(wrongPw.doorStatus, 'LOCKED');
  assert.equal(wrongPw.httpStatus, 401);

  const inactive = evaluateAccessAttempt(inactiveStaff, 'StaffPass1!');
  assert.equal(inactive.granted, false);
  assert.equal(inactive.decision, 'DENIED');
  assert.equal(inactive.doorStatus, 'LOCKED');
  assert.equal(inactive.httpStatus, 403);

  const unknown = evaluateAccessAttempt(null, 'anything');
  assert.equal(unknown.granted, false);
  assert.equal(unknown.httpStatus, 401);
});

test('filterAccessLogs sorts newest first and filters by status and search text', () => {
  const logs: AccessLogEntry[] = [
    {
      id: 'l1',
      employee_ref: 'emp-1',
      employee_id: 'DOC-101',
      employee_name: 'Dr. Maya Lin',
      role: 'Doctor',
      auth_method: 'Password',
      status: 'Granted',
      reason: 'Credentials verified',
      created_at: '2026-11-18T09:00:00.000Z',
    },
    {
      id: 'l2',
      employee_ref: 'emp-2',
      employee_id: 'STF-104',
      employee_name: 'Marcus Vance',
      role: 'Staff',
      auth_method: 'Password',
      status: 'Denied',
      reason: 'Account inactive',
      created_at: '2026-11-18T11:30:00.000Z',
    },
  ];

  const all = filterAccessLogs(logs, {});
  assert.equal(all[0].id, 'l2');

  const denied = filterAccessLogs(logs, { status: 'Denied' });
  assert.equal(denied.length, 1);
  assert.equal(denied[0].employee_id, 'STF-104');

  const searchByName = filterAccessLogs(logs, { search: 'maya' });
  assert.equal(searchByName.length, 1);
  assert.equal(searchByName[0].employee_id, 'DOC-101');
});

test('computeDashboardSummary and deriveAccessControlState aggregate counts accurately', () => {
  const employees: EmployeePublic[] = [
    {
      id: 'emp-1',
      employee_id: 'DOC-101',
      full_name: 'Dr. Maya Lin',
      role: 'Doctor',
      is_active: true,
      created_at: '2026-11-10T08:00:00.000Z',
      updated_at: '2026-11-10T08:00:00.000Z',
    },
    {
      id: 'emp-2',
      employee_id: 'STF-104',
      full_name: 'Marcus Vance',
      role: 'Staff',
      is_active: false,
      created_at: '2026-11-10T08:00:00.000Z',
      updated_at: '2026-11-10T08:00:00.000Z',
    },
  ];

  const logs: AccessLogEntry[] = [
    {
      id: 'l1',
      employee_ref: 'emp-1',
      employee_id: 'DOC-101',
      employee_name: 'Dr. Maya Lin',
      role: 'Doctor',
      auth_method: 'Password',
      status: 'Granted',
      reason: 'Credentials verified',
      created_at: '2026-11-18T10:00:00.000Z',
    },
    {
      id: 'l2',
      employee_ref: 'emp-2',
      employee_id: 'STF-104',
      employee_name: 'Marcus Vance',
      role: 'Staff',
      auth_method: 'Password',
      status: 'Denied',
      reason: 'Account inactive',
      created_at: '2026-11-18T11:00:00.000Z',
    },
  ];

  const summary = computeDashboardSummary(employees, logs, new Date('2026-11-18T12:00:00.000Z'));
  assert.equal(summary.totalEmployees, 2);
  assert.equal(summary.activeEmployees, 1);
  assert.equal(summary.inactiveEmployees, 1);
  assert.equal(summary.successfulLogins, 1);
  assert.equal(summary.failedLogins, 1);
  assert.equal(summary.grantRatePercent, 50);
  assert.equal(summary.dailyStats.length, 7);
  assert.equal(summary.dailyStats[6].granted, 1);
  assert.equal(summary.dailyStats[6].denied, 1);

  const unlockedState = deriveAccessControlState(logs[0], false);
  assert.equal(unlockedState.decision, 'GRANTED');
  assert.equal(unlockedState.doorStatus, 'UNLOCKED');

  const lockedOverride = deriveAccessControlState(logs[0], true);
  assert.equal(lockedOverride.decision, 'GRANTED');
  assert.equal(lockedOverride.doorStatus, 'LOCKED');

  const deniedState = deriveAccessControlState(logs[1], false);
  assert.equal(deniedState.decision, 'DENIED');
  assert.equal(deniedState.doorStatus, 'LOCKED');
});
