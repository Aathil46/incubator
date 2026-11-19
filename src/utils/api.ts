import type {
  AccessControlState,
  AccessLogEntry,
  ActiveEmployeeOption,
  DashboardSummary,
  EmployeePublic,
  EmployeeRole,
  LoginResponse,
  PasskeyCredentialPublic,
  SessionUser,
} from '../shared/types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      `Request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data as T;
}

export const api = {
  getSession: () => requestJson<{ user: SessionUser | null }>('/api/auth/session'),

  logout: () => requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  getPasskeys: () =>
    requestJson<{ passkeys: PasskeyCredentialPublic[] }>('/api/webauthn/passkeys'),

  getPasskeyRegistrationOptions: () =>
    requestJson<{ options: Parameters<typeof import('@simplewebauthn/browser').startRegistration>[0]['optionsJSON'] }>(
      '/api/webauthn/registration/options',
      { method: 'POST' },
    ),

  verifyPasskeyRegistration: (challenge: string, response: unknown) =>
    requestJson<{ passkey: PasskeyCredentialPublic }>('/api/webauthn/registration/verify', {
      method: 'POST',
      body: JSON.stringify({ challenge, response }),
    }),

  deletePasskey: (credentialId: string) =>
    requestJson<{ ok: boolean }>(
      `/api/webauthn/passkeys/${encodeURIComponent(credentialId)}`,
      { method: 'DELETE' },
    ),

  getPasskeyAuthenticationOptions: () =>
    requestJson<{ options: Parameters<typeof import('@simplewebauthn/browser').startAuthentication>[0]['optionsJSON'] }>(
      '/api/webauthn/authentication/options',
      { method: 'POST' },
    ),

  verifyPasskeyAuthentication: (challenge: string, response: unknown) =>
    requestJson<{
      authenticated: boolean;
      message: string;
      user?: SessionUser;
      decision: 'GRANTED';
      doorStatus: 'UNLOCKED';
    }>('/api/webauthn/authentication/verify', {
      method: 'POST',
      body: JSON.stringify({ challenge, response }),
    }),

  getActiveEmployees: () =>
    requestJson<{ employees: ActiveEmployeeOption[] }>('/api/employees/active'),

  loginEmployee: async (employeeId: string, password: string): Promise<LoginResponse> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && typeof data?.authenticated !== 'boolean') {
      throw new Error(data?.error || `Authentication failed (${response.status})`);
    }
    return data as LoginResponse;
  },

  getDashboard: () =>
    requestJson<{ summary: DashboardSummary; databaseMode: 'supabase' }>(
      '/api/dashboard',
    ),

  getAccessControl: () => requestJson<{ state: AccessControlState }>('/api/access-control'),

  lockSimulatedDoor: () =>
    requestJson<{ state: AccessControlState }>('/api/access-control/lock', { method: 'POST' }),

  getAccessLogs: (params: { search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params.search?.trim()) qs.set('search', params.search.trim());
    if (params.status && params.status !== 'All') qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<{ logs: AccessLogEntry[]; total: number }>(`/api/logs${suffix}`);
  },

  deleteAccessLog: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/logs/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  clearAccessLogs: () =>
    requestJson<{ ok: boolean; removed: number }>('/api/logs', { method: 'DELETE' }),

  adminListEmployees: () => requestJson<{ employees: EmployeePublic[] }>('/api/admin/employees'),

  adminCreateEmployee: (payload: {
    employee_id: string;
    full_name: string;
    role: EmployeeRole;
    password: string;
    is_active: boolean;
  }) =>
    requestJson<{ employee: EmployeePublic }>('/api/admin/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdateEmployee: (
    id: string,
    payload: {
      employee_id: string;
      full_name: string;
      role: EmployeeRole;
      password?: string;
      is_active: boolean;
    },
  ) =>
    requestJson<{ employee: EmployeePublic }>(`/api/admin/employees/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  adminToggleEmployeeStatus: (id: string, is_active: boolean) =>
    requestJson<{ employee: EmployeePublic }>(
      `/api/admin/employees/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ is_active }),
      },
    ),

  adminDeleteEmployee: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/admin/employees/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
