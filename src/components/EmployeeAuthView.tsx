import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  ActiveEmployeeOption,
  LoginResponse,
  PasskeyCredentialPublic,
  SessionUser,
} from '../shared/types';
import { api } from '../utils/api';
import type { NavSectionId } from './TopNav';

interface EmployeeAuthViewProps {
  sessionUser: SessionUser | null;
  onAuthSuccess: (user: SessionUser, response: LoginResponse) => void;
  onAuthRecorded: () => void;
  onLogout: () => void;
  onNavigate: (section: NavSectionId) => void;
}

export function EmployeeAuthView({
  sessionUser,
  onAuthSuccess,
  onAuthRecorded,
  onLogout,
  onNavigate,
}: EmployeeAuthViewProps) {
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [manualEntry, setManualEntry] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [manualEmployeeId, setManualEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [authResult, setAuthResult] = useState<{
    type: 'success' | 'error';
    message: string;
    user?: SessionUser;
  } | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyCredentialPublic[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);

  const fetchActiveEmployees = async () => {
    setLoadingEmployees(true);
    setLoadError(null);
    try {
      const { employees } = await api.getActiveEmployees();
      setActiveEmployees(employees);
      if (employees.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(employees[0].employee_id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load active employees.');
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchActiveEmployees();
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      setPasskeys([]);
      return;
    }
    api.getPasskeys()
      .then(({ passkeys: records }) => setPasskeys(records))
      .catch(() => setPasskeys([]));
  }, [sessionUser]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAuthResult(null);

    const employeeId = (manualEntry ? manualEmployeeId : selectedEmployeeId).trim();
    if (!employeeId) {
      setAuthResult({
        type: 'error',
        message: 'Please select or enter an Employee ID.',
      });
      return;
    }
    if (!password) {
      setAuthResult({
        type: 'error',
        message: 'Please enter your password.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.loginEmployee(employeeId, password);
      onAuthRecorded();

      if (result.authenticated && result.user) {
        setAuthResult({
          type: 'success',
          message: result.message,
          user: result.user,
        });
        setPassword('');
        onAuthSuccess(result.user, result);
      } else {
        setAuthResult({
          type: 'error',
          message: result.message || 'Access Denied: Authentication failed.',
        });
      }
    } catch (err) {
      setAuthResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Authentication request failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyBusy(true);
    setPasskeyMessage(null);
    setAuthResult(null);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('This device or browser does not support passkeys.');
      }
      const { options } = await api.getPasskeyAuthenticationOptions();
      const optionsJSON = options as Parameters<typeof startAuthentication>[0]['optionsJSON'];
      const challenge = String(optionsJSON.challenge);
      const response = await startAuthentication({ optionsJSON });
      const result = await api.verifyPasskeyAuthentication(challenge, response);
      if (result.authenticated && result.user) {
        setAuthResult({
          type: 'success',
          message: result.message,
          user: result.user,
        });
        onAuthSuccess(result.user, result as LoginResponse);
      } else {
        setAuthResult({ type: 'error', message: result.message });
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Fingerprint authentication could not be completed.';
      void api.recordPasskeyFailure(
        message.includes('cancel')
          ? 'Passkey authentication cancelled'
          : 'Passkey authentication unavailable or failed',
      ).catch(() => undefined);
      setPasskeyMessage(message);
      setAuthResult({
        type: 'error',
        message:
          message.includes('cancel')
            ? 'Fingerprint verification was cancelled.'
            : 'Fingerprint login failed. Use your Employee ID and password instead.',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setPasskeyBusy(true);
    setPasskeyMessage(null);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('This device or browser does not support passkeys.');
      }
      const { options } = await api.getPasskeyRegistrationOptions();
      const optionsJSON = options as Parameters<typeof startRegistration>[0]['optionsJSON'];
      const challenge = String(optionsJSON.challenge);
      const response = await startRegistration({ optionsJSON });
      await api.verifyPasskeyRegistration(challenge, response);
      const { passkeys: records } = await api.getPasskeys();
      setPasskeys(records);
      setPasskeyMessage('Passkey registered securely on this device.');
    } catch (err) {
      setPasskeyMessage(
        err instanceof Error
          ? err.message
          : 'Passkey registration could not be completed.',
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRemovePasskey = async (credentialId: string) => {
    setPasskeyBusy(true);
    setPasskeyMessage(null);
    try {
      await api.deletePasskey(credentialId);
      setPasskeys((current) => current.filter((passkey) => passkey.credential_id !== credentialId));
      setPasskeyMessage('Passkey removed from this account.');
    } catch (err) {
      setPasskeyMessage(err instanceof Error ? err.message : 'Unable to remove passkey.');
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
          Employee Authentication
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Verify hospital personnel credentials using Employee ID and Password. Every attempt is logged server-side.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Authentication Form Card */}
        <section className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 shrink-0">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Incubator Room Credential Check
              </h2>
              <p className="text-xs text-slate-500">
                Password verification against active personnel records
              </p>
            </div>
          </div>

          {loadError && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={fetchActiveEmployees}
                className="text-xs font-semibold underline shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor={manualEntry ? 'manual-employee-id' : 'employee-id-select'}
                  className="block text-sm font-medium text-slate-700"
                >
                  Employee ID
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setManualEntry((prev) => !prev);
                    setAuthResult(null);
                  }}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800"
                >
                  {manualEntry ? 'Choose from active employee list' : 'Enter Employee ID manually'}
                </button>
              </div>

              {manualEntry ? (
                <input
                  id="manual-employee-id"
                  type="text"
                  value={manualEmployeeId}
                  onChange={(e) => setManualEmployeeId(e.target.value)}
                  placeholder="e.g. DOC-101 or STF-104"
                  autoComplete="username"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              ) : (
                <select
                  id="employee-id-select"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  disabled={loadingEmployees || activeEmployees.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {loadingEmployees ? (
                    <option value="">Loading active employees...</option>
                  ) : activeEmployees.length === 0 ? (
                    <option value="">No active employees available</option>
                  ) : (
                    activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.employee_id}>
                        {emp.employee_id} — {emp.full_name} ({emp.role})
                      </option>
                    ))
                  )}
                </select>
              )}
              <p className="mt-1.5 text-xs text-slate-500">
                {manualEntry
                  ? 'Manual entry allows testing unregistered or deactivated Employee IDs.'
                  : 'Dropdown loads active employee accounts stored in the database.'}
              </p>
            </div>

            <div>
              <label
                htmlFor="employee-password-input"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="employee-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {authResult && (
              <div
                role="alert"
                className={`rounded-lg border px-4 py-3.5 text-sm flex items-start gap-3 ${
                  authResult.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                {authResult.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {authResult.type === 'success' ? 'Access Granted' : 'Authentication Failed'}
                  </p>
                  <p className="mt-0.5">{authResult.message}</p>
                  {authResult.type === 'success' && authResult.user && (
                    <div className="mt-3 pt-2.5 border-t border-emerald-200/80 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-900">
                      <span>
                        Name: <strong className="font-semibold">{authResult.user.full_name}</strong>
                      </span>
                      <span>
                        ID:{' '}
                        <strong className="font-mono font-semibold tabular-nums">
                          {authResult.user.employee_id}
                        </strong>
                      </span>
                      <span>
                        Role: <strong className="font-semibold">{authResult.user.role}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || (!manualEntry && activeEmployees.length === 0)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 px-5 py-2.5 text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                {submitting ? 'Verifying Credentials...' : 'Authenticate & Login'}
              </button>
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={passkeyBusy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-700"
              >
                <Fingerprint className="h-4 w-4" aria-hidden="true" />
                {passkeyBusy ? 'Checking Passkey...' : 'Login with Fingerprint'}
              </button>

              {authResult?.type === 'success' && (
                <button
                  type="button"
                  onClick={() => onNavigate('access-control')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors"
                >
                  View Access Control
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Session & Policy Panel */}
        <aside className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0">
              <UserCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Current Session
              </h2>
              <p className="text-xs text-slate-500">Active authenticated operator</p>
            </div>
          </div>

          {sessionUser ? (
            <div className="space-y-4">
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Employee Name</dt>
                  <dd className="font-semibold text-slate-900">{sessionUser.full_name}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-100">
                  <dt className="text-slate-500">Employee ID</dt>
                  <dd className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                    {sessionUser.employee_id}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-1.5">
                  <dt className="text-slate-500">Role</dt>
                  <dd className="font-semibold text-blue-700">{sessionUser.role}</dd>
                </div>
              </dl>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">Device Passkeys</p>
                  <button
                    type="button"
                    onClick={handleRegisterPasskey}
                    disabled={passkeyBusy}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                  >
                    <Fingerprint className="h-4 w-4" aria-hidden="true" />
                    Register Fingerprint
                  </button>
                </div>

                {passkeys.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                    No passkeys are registered for this account.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {passkeys.map((passkey) => (
                      <li
                        key={passkey.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {passkey.device_name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Registered {new Date(passkey.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePasskey(passkey.credential_id)}
                          disabled={passkeyBusy}
                          aria-label={`Remove ${passkey.device_name}`}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {passkeyMessage && (
                  <p role="status" className="text-xs font-medium text-slate-700">
                    {passkeyMessage}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                {sessionUser.role === 'Admin' && (
                  <button
                    type="button"
                    onClick={() => onNavigate('admin-panel')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 px-3.5 py-2 text-xs font-semibold text-blue-800 transition-colors"
                  >
                    Open Admin Panel
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No employee is currently signed in. Authenticate on the left to establish an access session.
            </p>
          )}

          <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Authentication Policy</p>
            <ul className="space-y-1.5 list-disc pl-4">
              <li>Credentials are verified server-side against salted scrypt password hashes.</li>
              <li>Deactivated accounts are automatically rejected and logged as Denied.</li>
              <li>Administrator privileges are required for employee and audit log management.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
