import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type {
  AccessLogEntry,
  AccessStatus,
  EmployeePublic,
  EmployeeRecord,
  EmployeeRole,
  PasskeyCredentialPublic,
} from '../src/shared/types.ts';
import { hashPassword } from './security.ts';

export interface CreateEmployeeParams {
  employee_id: string;
  full_name: string;
  role: EmployeeRole;
  password: string;
  is_active: boolean;
}

export interface UpdateEmployeeParams {
  employee_id: string;
  full_name: string;
  role: EmployeeRole;
  is_active: boolean;
  password?: string;
}

export interface CreateAccessLogParams {
  employee_ref: string | null;
  employee_id: string;
  employee_name: string;
  role: string;
  status: AccessStatus;
  reason: string;
  auth_method?: 'Password' | 'Passkey';
}

export interface PasskeyCredentialRecord extends PasskeyCredentialPublic {
  employee_id: string;
  public_key: string;
  counter: number;
}

export interface StorePasskeyParams {
  employee_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[];
  device_name: string;
  backup_eligible: boolean;
  backup_state: boolean;
}

export interface DatabaseStore {
  readonly mode: 'supabase';
  ensureSeeded(): Promise<void>;
  listAllEmployees(): Promise<EmployeePublic[]>;
  listActiveEmployees(): Promise<EmployeePublic[]>;
  findEmployeeByEmployeeId(employeeId: string): Promise<EmployeeRecord | null>;
  findEmployeeById(id: string): Promise<EmployeeRecord | null>;
  createEmployee(params: CreateEmployeeParams): Promise<EmployeePublic>;
  updateEmployee(id: string, params: UpdateEmployeeParams): Promise<EmployeePublic | null>;
  setEmployeeStatus(id: string, isActive: boolean): Promise<EmployeePublic | null>;
  deleteEmployee(id: string): Promise<boolean>;
  listAccessLogs(): Promise<AccessLogEntry[]>;
  getLatestAccessLog(): Promise<AccessLogEntry | null>;
  createAccessLog(params: CreateAccessLogParams): Promise<AccessLogEntry>;
  deleteAccessLog(id: string): Promise<boolean>;
  clearAccessLogs(): Promise<number>;
  listPasskeys(employeeId: string): Promise<PasskeyCredentialPublic[]>;
  findPasskeyByCredentialId(credentialId: string): Promise<PasskeyCredentialRecord | null>;
  listPasskeysWithCredentials(): Promise<PasskeyCredentialRecord[]>;
  storePasskey(params: StorePasskeyParams): Promise<PasskeyCredentialPublic>;
  updatePasskeyCounter(credentialId: string, counter: number): Promise<void>;
  deletePasskey(employeeId: string, credentialId: string): Promise<boolean>;
}

class SupabaseStore implements DatabaseStore {
  readonly mode = 'supabase' as const;
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async ensureSeeded(): Promise<void> {
    const { count, error } = await this.client
      .from('employees')
      .select('id', { count: 'exact', head: true });

    if (error) {
      throw new Error(
        `Supabase query failed (code=${error.code ?? 'unknown'}, message=${error.message || 'none'}, details=${error.details || 'none'}). Ensure supabase/schema.sql has been executed and the service-role key is valid.`,
      );
    }

    if ((count ?? 0) === 0) {
      const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
      const bootstrapEmployeeId =
        process.env.BOOTSTRAP_ADMIN_EMPLOYEE_ID?.trim().toUpperCase() || 'ADM-001';
      const bootstrapFullName =
        process.env.BOOTSTRAP_ADMIN_FULL_NAME?.trim() || 'System Administrator';

      if (!bootstrapPassword || bootstrapPassword.length < 12) {
        throw new Error(
          'BOOTSTRAP_ADMIN_PASSWORD must be set to at least 12 characters before the first administrator is created.',
        );
      }

      const bootstrapAdmin: EmployeeRecord = {
        id: randomUUID(),
        employee_id: bootstrapEmployeeId,
        full_name: bootstrapFullName,
        role: 'Admin',
        password_hash: hashPassword(bootstrapPassword),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error: empErr } = await this.client.from('employees').insert([bootstrapAdmin]);
      if (empErr) {
        throw new Error(`Failed to initialize bootstrap administrator in Supabase: ${empErr.message}`);
      }
    }
  }

  async listAllEmployees(): Promise<EmployeePublic[]> {
    const { data, error } = await this.client
      .from('employees')
      .select('id, employee_id, full_name, role, is_active, created_at, updated_at')
      .order('employee_id', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeePublic[];
  }

  async listActiveEmployees(): Promise<EmployeePublic[]> {
    const { data, error } = await this.client
      .from('employees')
      .select('id, employee_id, full_name, role, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('employee_id', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeePublic[];
  }

  async findEmployeeByEmployeeId(employeeId: string): Promise<EmployeeRecord | null> {
    const normalized = employeeId.trim().toUpperCase();
    const { data, error } = await this.client
      .from('employees')
      .select('*')
      .eq('employee_id', normalized)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as EmployeeRecord | null) ?? null;
  }

  async findEmployeeById(id: string): Promise<EmployeeRecord | null> {
    const { data, error } = await this.client
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as EmployeeRecord | null) ?? null;
  }

  async createEmployee(params: CreateEmployeeParams): Promise<EmployeePublic> {
    const existing = await this.findEmployeeByEmployeeId(params.employee_id);
    if (existing) {
      const err = new Error(`Employee ID "${params.employee_id}" already exists.`);
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }

    const { data, error } = await this.client
      .from('employees')
      .insert({
        employee_id: params.employee_id,
        full_name: params.full_name,
        role: params.role,
        password_hash: hashPassword(params.password),
        is_active: params.is_active,
      })
      .select('id, employee_id, full_name, role, is_active, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        const err = new Error(`Employee ID "${params.employee_id}" already exists.`);
        (err as Error & { statusCode?: number }).statusCode = 409;
        throw err;
      }
      throw new Error(error.message);
    }

    return data as EmployeePublic;
  }

  async updateEmployee(id: string, params: UpdateEmployeeParams): Promise<EmployeePublic | null> {
    const existingById = await this.findEmployeeById(id);
    if (!existingById) return null;

    if (existingById.employee_id !== params.employee_id) {
      const conflict = await this.findEmployeeByEmployeeId(params.employee_id);
      if (conflict && conflict.id !== id) {
        const err = new Error(`Employee ID "${params.employee_id}" already exists.`);
        (err as Error & { statusCode?: number }).statusCode = 409;
        throw err;
      }
    }

    const updatePayload: Record<string, unknown> = {
      employee_id: params.employee_id,
      full_name: params.full_name,
      role: params.role,
      is_active: params.is_active,
    };
    if (params.password) {
      updatePayload.password_hash = hashPassword(params.password);
    }

    const { data, error } = await this.client
      .from('employees')
      .update(updatePayload)
      .eq('id', id)
      .select('id, employee_id, full_name, role, is_active, created_at, updated_at')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as EmployeePublic | null) ?? null;
  }

  async setEmployeeStatus(id: string, isActive: boolean): Promise<EmployeePublic | null> {
    const { data, error } = await this.client
      .from('employees')
      .update({ is_active: isActive })
      .eq('id', id)
      .select('id, employee_id, full_name, role, is_active, created_at, updated_at')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as EmployeePublic | null) ?? null;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('employees')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw new Error(error.message);
    return Array.isArray(data) && data.length > 0;
  }

  async listAccessLogs(): Promise<AccessLogEntry[]> {
    const { data, error } = await this.client
      .from('access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    return (data ?? []) as AccessLogEntry[];
  }

  async getLatestAccessLog(): Promise<AccessLogEntry | null> {
    const { data, error } = await this.client
      .from('access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data as AccessLogEntry | null) ?? null;
  }

  async createAccessLog(params: CreateAccessLogParams): Promise<AccessLogEntry> {
    const { data, error } = await this.client
      .from('access_logs')
      .insert({
        employee_ref: params.employee_ref,
        employee_id: params.employee_id,
        employee_name: params.employee_name,
        role: params.role,
        auth_method: params.auth_method ?? 'Password',
        status: params.status,
        reason: params.reason,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as AccessLogEntry;
  }

  async deleteAccessLog(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('access_logs')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw new Error(error.message);
    return Array.isArray(data) && data.length > 0;
  }

  async clearAccessLogs(): Promise<number> {
    const { data, error } = await this.client
      .from('access_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');

    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data.length : 0;
  }

  async listPasskeys(employeeId: string): Promise<PasskeyCredentialPublic[]> {
    const { data, error } = await this.client
      .from('passkey_credentials')
      .select('id, credential_id, device_name, transports, backup_eligible, backup_state, created_at, last_used_at')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PasskeyCredentialPublic[];
  }

  async findPasskeyByCredentialId(credentialId: string): Promise<PasskeyCredentialRecord | null> {
    const { data, error } = await this.client
      .from('passkey_credentials')
      .select('*')
      .eq('credential_id', credentialId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as PasskeyCredentialRecord | null) ?? null;
  }

  async listPasskeysWithCredentials(): Promise<PasskeyCredentialRecord[]> {
    const { data, error } = await this.client
      .from('passkey_credentials')
      .select('*');
    if (error) throw new Error(error.message);
    return (data ?? []) as PasskeyCredentialRecord[];
  }

  async storePasskey(params: StorePasskeyParams): Promise<PasskeyCredentialPublic> {
    const { data, error } = await this.client
      .from('passkey_credentials')
      .insert({
        employee_id: params.employee_id,
        credential_id: params.credential_id,
        public_key: params.public_key,
        counter: params.counter,
        transports: params.transports,
        device_name: params.device_name,
        backup_eligible: params.backup_eligible,
        backup_state: params.backup_state,
      })
      .select('id, credential_id, device_name, transports, backup_eligible, backup_state, created_at, last_used_at')
      .single();
    if (error) throw new Error(error.message);
    return data as PasskeyCredentialPublic;
  }

  async updatePasskeyCounter(credentialId: string, counter: number): Promise<void> {
    const { error } = await this.client
      .from('passkey_credentials')
      .update({ counter, last_used_at: new Date().toISOString() })
      .eq('credential_id', credentialId);
    if (error) throw new Error(error.message);
  }

  async deletePasskey(employeeId: string, credentialId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('passkey_credentials')
      .delete()
      .eq('employee_id', employeeId)
      .eq('credential_id', credentialId)
      .select('id');
    if (error) throw new Error(error.message);
    return Array.isArray(data) && data.length > 0;
  }
}

export function createDatabaseStore(): DatabaseStore {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !/^https:\/\/[^/\s]+\.supabase\.co\/?$/.test(supabaseUrl)) {
    throw new Error('SUPABASE_URL must be configured as https://<project-ref>.supabase.co.');
  }
  if (!serviceRoleKey || serviceRoleKey.includes('your-supabase')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured on the server.');
  }
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be configured on the server.');
  }

  return new SupabaseStore(supabaseUrl, serviceRoleKey);
}
