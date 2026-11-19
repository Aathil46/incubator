import type {
  AccessControlState,
  AccessDecision,
  AccessLogEntry,
  AccessStatus,
  DailyLoginStat,
  DashboardSummary,
  DoorStatus,
  EmployeePublic,
  EmployeeRecord,
  RoleBreakdownStat,
} from '../src/shared/types.ts';
import { EMPLOYEE_ROLES } from '../src/shared/types.ts';
import { verifyPassword } from './security.ts';

export interface AccessEvaluation {
  granted: boolean;
  status: AccessStatus;
  decision: AccessDecision;
  doorStatus: DoorStatus;
  reason: string;
  httpStatus: number;
  clientMessage: string;
}

export function evaluateAccessAttempt(
  employee: EmployeeRecord | null,
  password: string,
): AccessEvaluation {
  if (!employee) {
    return {
      granted: false,
      status: 'Denied',
      decision: 'DENIED',
      doorStatus: 'LOCKED',
      reason: 'Unknown Employee ID',
      httpStatus: 401,
      clientMessage: 'Access Denied: Employee ID was not found.',
    };
  }

  if (!employee.is_active) {
    return {
      granted: false,
      status: 'Denied',
      decision: 'DENIED',
      doorStatus: 'LOCKED',
      reason: 'Account inactive',
      httpStatus: 403,
      clientMessage: 'Access Denied: This employee account is currently inactive.',
    };
  }

  if (!verifyPassword(password, employee.password_hash)) {
    return {
      granted: false,
      status: 'Denied',
      decision: 'DENIED',
      doorStatus: 'LOCKED',
      reason: 'Invalid password',
      httpStatus: 401,
      clientMessage: 'Access Denied: Incorrect password.',
    };
  }

  return {
    granted: true,
    status: 'Granted',
    decision: 'GRANTED',
    doorStatus: 'UNLOCKED',
    reason: 'Credentials verified',
    httpStatus: 200,
    clientMessage: `Authentication successful. Welcome, ${employee.full_name}.`,
  };
}

export function toPublicEmployee(emp: EmployeeRecord): EmployeePublic {
  return {
    id: emp.id,
    employee_id: emp.employee_id,
    full_name: emp.full_name,
    role: emp.role,
    is_active: emp.is_active,
    created_at: emp.created_at,
    updated_at: emp.updated_at,
  };
}

export function filterAccessLogs(
  logs: AccessLogEntry[],
  query: { search?: string; status?: string },
): AccessLogEntry[] {
  const normalizedSearch = (query.search ?? '').trim().toLowerCase();
  const statusFilter = query.status ?? 'All';

  return [...logs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((entry) => {
      if (statusFilter === 'Granted' || statusFilter === 'Denied') {
        if (entry.status !== statusFilter) {
          return false;
        }
      }
      if (!normalizedSearch) {
        return true;
      }
      return (
        entry.employee_id.toLowerCase().includes(normalizedSearch) ||
        entry.employee_name.toLowerCase().includes(normalizedSearch) ||
        entry.role.toLowerCase().includes(normalizedSearch)
      );
    });
}

export function computeDashboardSummary(
  employees: EmployeePublic[],
  logs: AccessLogEntry[],
  referenceDate = new Date(),
): DashboardSummary {
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.is_active).length;
  const inactiveEmployees = totalEmployees - activeEmployees;

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const successfulLogins = sortedLogs.filter((l) => l.status === 'Granted').length;
  const failedLogins = sortedLogs.filter((l) => l.status === 'Denied').length;
  const totalAttempts = successfulLogins + failedLogins;
  const grantRatePercent = totalAttempts > 0 ? Math.round((successfulLogins / totalAttempts) * 100) : 0;

  // Build 7-day rolling statistics ending at referenceDate
  const dailyStats: DailyLoginStat[] = [];
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayDate = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate() - offset,
      ),
    );
    const isoDay = dayDate.toISOString().slice(0, 10);
    const dayLogs = sortedLogs.filter((l) => l.created_at.slice(0, 10) === isoDay);
    dailyStats.push({
      date: isoDay,
      label: formatter.format(dayDate),
      granted: dayLogs.filter((l) => l.status === 'Granted').length,
      denied: dayLogs.filter((l) => l.status === 'Denied').length,
    });
  }

  const roleBreakdown: RoleBreakdownStat[] = EMPLOYEE_ROLES.map((role) => {
    const matching = employees.filter((e) => e.role === role);
    return {
      role,
      total: matching.length,
      active: matching.filter((e) => e.is_active).length,
    };
  });

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    successfulLogins,
    failedLogins,
    grantRatePercent,
    recentLogs: sortedLogs.slice(0, 6),
    dailyStats,
    roleBreakdown,
  };
}

export function deriveAccessControlState(
  latestLog: AccessLogEntry | null,
  simulationOverriddenLocked: boolean,
): AccessControlState {
  if (!latestLog) {
    return {
      latestLog: null,
      decision: 'PENDING',
      doorStatus: 'LOCKED',
      simulationOverriddenLocked: false,
      evaluatedAt: null,
    };
  }

  const decision: AccessDecision = latestLog.status === 'Granted' ? 'GRANTED' : 'DENIED';
  const doorStatus: DoorStatus =
    decision === 'GRANTED' && !simulationOverriddenLocked ? 'UNLOCKED' : 'LOCKED';

  return {
    latestLog,
    decision,
    doorStatus,
    simulationOverriddenLocked: decision === 'GRANTED' ? simulationOverriddenLocked : false,
    evaluatedAt: latestLog.created_at,
  };
}
