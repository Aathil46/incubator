export const EMPLOYEE_ROLES = ['Doctor', 'Nurse', 'Admin', 'Staff'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export type AccessStatus = 'Granted' | 'Denied';
export type AccessDecision = 'GRANTED' | 'DENIED' | 'PENDING';
export type DoorStatus = 'LOCKED' | 'UNLOCKED';

export interface EmployeeRecord {
  id: string;
  employee_id: string;
  full_name: string;
  role: EmployeeRole;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeePublic {
  id: string;
  employee_id: string;
  full_name: string;
  role: EmployeeRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActiveEmployeeOption {
  id: string;
  employee_id: string;
  full_name: string;
  role: EmployeeRole;
}

export interface AccessLogEntry {
  id: string;
  employee_ref: string | null;
  employee_id: string;
  employee_name: string;
  role: string;
  auth_method: 'Password';
  status: AccessStatus;
  reason: string;
  created_at: string;
}

export interface SessionUser {
  id: string;
  employee_id: string;
  full_name: string;
  role: EmployeeRole;
}

export interface PasskeyCredentialPublic {
  id: string;
  credential_id: string;
  name?: string;
  created_at: string;
  last_used_at?: string | null;
  transports?: string[];
}

export interface DailyLoginStat {
  date: string;
  label: string;
  granted: number;
  denied: number;
}

export interface RoleBreakdownStat {
  role: EmployeeRole;
  total: number;
  active: number;
}

export interface DashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  successfulLogins: number;
  failedLogins: number;
  grantRatePercent: number;
  recentLogs: AccessLogEntry[];
  dailyStats: DailyLoginStat[];
  roleBreakdown: RoleBreakdownStat[];
}

export interface AccessControlState {
  latestLog: AccessLogEntry | null;
  decision: AccessDecision;
  doorStatus: DoorStatus;
  simulationOverriddenLocked: boolean;
  evaluatedAt: string | null;
}

export interface LoginResponse {
  authenticated: boolean;
  message: string;
  user?: SessionUser;
  decision: AccessDecision;
  doorStatus: DoorStatus;
  log: AccessLogEntry;
}
