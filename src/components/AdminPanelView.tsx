import {
  AlertCircle,
  Edit3,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { EmployeePublic, EmployeeRole, SessionUser } from '../shared/types';
import { EMPLOYEE_ROLES } from '../shared/types';
import { api } from '../utils/api';
import { formatShortDate } from '../utils/formatters';
import { AccountStatusLabel } from './StatusBadge';

interface AdminPanelViewProps {
  sessionUser: SessionUser | null;
  onAdminSessionEstablished: (user: SessionUser) => void;
  onEmployeesChanged: () => void;
}

interface EmployeeFormState {
  employee_id: string;
  full_name: string;
  role: EmployeeRole;
  password: string;
  is_active: boolean;
}

const INITIAL_FORM: EmployeeFormState = {
  employee_id: '',
  full_name: '',
  role: 'Doctor',
  password: '',
  is_active: true,
};

export function AdminPanelView({
  sessionUser,
  onAdminSessionEstablished,
  onEmployeesChanged,
}: AdminPanelViewProps) {
  const isAdmin = sessionUser?.role === 'Admin';

  // Inline Admin sign-in state when unauthorized
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminLoginPassword, setAdminLoginPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [signingInAdmin, setSigningInAdmin] = useState(false);

  // Admin employee management state
  const [employees, setEmployees] = useState<EmployeePublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeePublic | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<EmployeePublic | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const loadEmployees = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminListEmployees();
      setEmployees(res.employees);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch employee records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadEmployees();
    } else {
      setEmployees([]);
    }
  }, [isAdmin]);

  const handleAdminSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setAdminLoginError(null);

    if (!adminLoginId.trim() || !adminLoginPassword) {
      setAdminLoginError('Please enter both Administrator Employee ID and Password.');
      return;
    }

    setSigningInAdmin(true);
    try {
      const res = await api.loginEmployee(adminLoginId.trim(), adminLoginPassword);
      onEmployeesChanged();
      if (!res.authenticated || !res.user) {
        setAdminLoginError(res.message || 'Authentication failed.');
        return;
      }
      if (res.user.role !== 'Admin') {
        setAdminLoginError(
          `Signed in as ${res.user.full_name} (${res.user.role}), which does not have Admin permissions.`,
        );
        onAdminSessionEstablished(res.user);
        return;
      }
      setAdminLoginPassword('');
      onAdminSessionEstablished(res.user);
    } catch (err) {
      setAdminLoginError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSigningInAdmin(false);
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setEditingEmployee(null);
    setForm(INITIAL_FORM);
    setFormError(null);
  };

  const openEditModal = (emp: EmployeePublic) => {
    setModalMode('edit');
    setEditingEmployee(emp);
    setForm({
      employee_id: emp.employee_id,
      full_name: emp.full_name,
      role: emp.role,
      password: '',
      is_active: emp.is_active,
    });
    setFormError(null);
  };

  const handleSaveEmployee = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const empId = form.employee_id.trim().toUpperCase();
    const fullName = form.full_name.trim();

    if (!empId || !/^[A-Z0-9-]{3,24}$/.test(empId)) {
      setFormError('Employee ID must be 3–24 characters using letters, numbers, or hyphens.');
      return;
    }
    if (fullName.length < 2) {
      setFormError('Full Name must be at least 2 characters.');
      return;
    }
    if (modalMode === 'add' && form.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (modalMode === 'edit' && form.password && form.password.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'add') {
        await api.adminCreateEmployee({
          employee_id: empId,
          full_name: fullName,
          role: form.role,
          password: form.password,
          is_active: form.is_active,
        });
      } else if (modalMode === 'edit' && editingEmployee) {
        await api.adminUpdateEmployee(editingEmployee.id, {
          employee_id: empId,
          full_name: fullName,
          role: form.role,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        });
      }
      setModalMode(null);
      await loadEmployees();
      onEmployeesChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save employee record.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (emp: EmployeePublic) => {
    setBannerError(null);
    try {
      await api.adminToggleEmployeeStatus(emp.id, !emp.is_active);
      await loadEmployees();
      onEmployeesChanged();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to update account status.');
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setBannerError(null);
    try {
      await api.adminDeleteEmployee(deleteTarget.id);
      setDeleteTarget(null);
      await loadEmployees();
      onEmployeesChanged();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to delete employee.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Hospital personnel account provisioning and access role management.
          </p>
        </div>

        <section className="max-w-xl bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 shrink-0">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Administrator Authorization Required
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {sessionUser
                  ? `Currently signed in as ${sessionUser.full_name} (${sessionUser.role}). Only accounts with the Admin role can manage employee records.`
                  : 'Sign in with an authorized Administrator account to add, edit, activate, or remove hospital staff.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleAdminSignIn} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="admin-login-id"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Administrator Employee ID
              </label>
              <input
                id="admin-login-id"
                type="text"
                value={adminLoginId}
                onChange={(e) => setAdminLoginId(e.target.value)}
                placeholder="e.g. ADM-001"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label
                htmlFor="admin-login-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="admin-login-password"
                type="password"
                value={adminLoginPassword}
                onChange={(e) => setAdminLoginPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {adminLoginError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{adminLoginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={signingInAdmin}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 px-5 py-2.5 text-sm font-medium text-white transition-colors"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {signingInAdmin ? 'Verifying Admin...' : 'Sign In as Administrator'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEmployees = employees.filter((emp) => {
    if (!normalizedQuery) return true;
    return (
      emp.employee_id.toLowerCase().includes(normalizedQuery) ||
      emp.full_name.toLowerCase().includes(normalizedQuery) ||
      emp.role.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage hospital employee credentials, roles, and incubator room access eligibility.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] px-4 py-2.5 text-sm font-medium text-white whitespace-nowrap shrink-0 transition-colors"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add Employee
        </button>
      </div>

      {/* Search Bar */}
      <section className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search employees by ID, name, or role"
            placeholder="Search employees by ID, name, or role..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>
        <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
          {filteredEmployees.length} of {employees.length} employees
        </span>
      </section>

      {bannerError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3"
        >
          <span>{bannerError}</span>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            aria-label="Dismiss error"
            className="text-red-700 hover:text-red-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Employees Table */}
      <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading && employees.length === 0 ? (
          <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading employees">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-11 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={loadEmployees}
              className="mt-3 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-900">No employees found</p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery
                ? 'Adjust your search query or add a new employee account.'
                : 'Click "Add Employee" to register your first personnel record.'}
            </p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const isSelf = sessionUser?.id === emp.id;
                return (
                  <div key={emp.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">
                          {emp.full_name}
                        </p>
                        <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          {emp.employee_id} · {emp.role} · {formatShortDate(emp.created_at)}
                        </p>
                      </div>
                      <AccountStatusLabel active={emp.is_active} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(emp)}
                        aria-label={`Edit ${emp.full_name} (mobile)`}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(emp)}
                        disabled={isSelf && emp.is_active}
                        aria-label={`${emp.is_active ? 'Deactivate' : 'Activate'} ${emp.full_name} (mobile)`}
                        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                          emp.is_active
                            ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {emp.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(emp)}
                        disabled={isSelf}
                        aria-label={`Delete ${emp.full_name} (mobile)`}
                        className="inline-flex items-center gap-1 rounded-md bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-5">Employee ID</th>
                    <th className="py-3.5 px-4">Full Name</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Account Status</th>
                    <th className="py-3.5 px-4">Created</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredEmployees.map((emp) => {
                    const isSelf = sessionUser?.id === emp.id;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {emp.employee_id}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {emp.full_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">{emp.role}</td>
                        <td className="py-3.5 px-4">
                          <AccountStatusLabel active={emp.is_active} />
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {formatShortDate(emp.created_at)}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(emp)}
                              aria-label={`Edit ${emp.full_name}`}
                              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(emp)}
                              disabled={isSelf && emp.is_active}
                              aria-label={`${emp.is_active ? 'Deactivate' : 'Activate'} ${emp.full_name}`}
                              title={
                                isSelf && emp.is_active
                                  ? 'Cannot deactivate your own active Admin account'
                                  : undefined
                              }
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                                emp.is_active
                                  ? 'text-amber-800 hover:bg-amber-50'
                                  : 'text-emerald-800 hover:bg-emerald-50'
                              }`}
                            >
                              {emp.is_active ? (
                                <>
                                  <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                  Activate
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(emp)}
                              disabled={isSelf}
                              aria-label={`Delete ${emp.full_name}`}
                              title={isSelf ? 'Cannot delete your own active Admin account' : undefined}
                              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Add / Edit Employee Modal */}
      {modalMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2
                id="employee-modal-title"
                className="font-display text-lg font-semibold text-slate-900"
              >
                {modalMode === 'add' ? 'Add New Employee' : `Edit Employee (${editingEmployee?.employee_id})`}
              </h2>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                aria-label="Close modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="mt-5 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="emp-form-id"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Employee ID
                </label>
                <input
                  id="emp-form-id"
                  type="text"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  placeholder="e.g. DOC-205"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="emp-form-name"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="emp-form-name"
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Dr. Priya Nair"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="emp-form-role"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="emp-form-role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as EmployeeRole })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    {EMPLOYEE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="emp-form-status"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Account Status
                  </label>
                  <select
                    id="emp-form-status"
                    value={form.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="emp-form-password"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  {modalMode === 'add' ? 'Password' : 'New Password (optional)'}
                </label>
                <input
                  id="emp-form-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={
                    modalMode === 'add'
                      ? 'Minimum 6 characters'
                      : 'Leave blank to keep existing password'
                  }
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
                >
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 px-4 py-2 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {saving
                    ? 'Saving...'
                    : modalMode === 'add'
                    ? 'Create Employee'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-emp-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
            <h2 id="delete-emp-title" className="font-display text-lg font-semibold text-slate-900">
              Delete Employee Account
            </h2>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <strong className="font-semibold text-slate-900">{deleteTarget.full_name}</strong> (
              <span className="font-mono text-xs">{deleteTarget.employee_id}</span>)? Past access logs
              will be preserved for audit compliance.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={deleting}
                className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white"
              >
                {deleting ? 'Deleting...' : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
