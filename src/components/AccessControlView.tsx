import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DoorClosed,
  DoorOpen,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { useState } from 'react';
import type { AccessControlState } from '../shared/types';
import { formatDateTime } from '../utils/formatters';
import { AccessStatusLabel } from './StatusBadge';
import type { NavSectionId } from './TopNav';

interface AccessControlViewProps {
  state: AccessControlState | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onLockSimulation: () => Promise<void>;
  onNavigate: (section: NavSectionId) => void;
}

export function AccessControlView({
  state,
  loading,
  error,
  onRefresh,
  onLockSimulation,
  onNavigate,
}: AccessControlViewProps) {
  const [locking, setLocking] = useState(false);

  const handleLock = async () => {
    setLocking(true);
    try {
      await onLockSimulation();
    } finally {
      setLocking(false);
    }
  };

  if (loading && !state) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-8 shadow-sm animate-pulse h-80" />
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Unable to load access decision state
            </h2>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const latest = state?.latestLog ?? null;
  const decision = state?.decision ?? 'PENDING';
  const doorStatus = state?.doorStatus ?? 'LOCKED';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Access Control
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time evaluation of the latest employee authentication event and simulated door lock state.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => onNavigate('employee-auth')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white whitespace-nowrap"
          >
            Run Authentication
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!latest ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-10 text-center shadow-sm">
          <Lock className="h-10 w-10 text-slate-400 mx-auto" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
            No authentication events evaluated yet
          </h2>
          <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
            The simulated incubator room door remains LOCKED until an employee completes password verification.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('employee-auth')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white"
          >
            Go to Employee Authentication
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Access Decision & Door Status Panel */}
          <section className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Access Decision &amp; Door Status
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Software demonstration simulation only — no physical door hardware is integrated
                </p>
              </div>
              <AccessStatusLabel status={latest.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Access Decision */}
              <div
                className={`rounded-xl border p-5 ${
                  decision === 'GRANTED'
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : 'border-red-200 bg-red-50/70'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  {decision === 'GRANTED' ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <ShieldX className="h-4 w-4 text-red-700" aria-hidden="true" />
                  )}
                  Access Decision
                </div>
                <p
                  data-testid="access-decision-value"
                  className={`mt-2.5 font-display text-2xl font-bold tracking-tight ${
                    decision === 'GRANTED' ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  {decision}
                </p>
                <p className="mt-1 text-xs text-slate-600">{latest.reason}</p>
              </div>

              {/* Door Simulation */}
              <div
                className={`rounded-xl border p-5 ${
                  doorStatus === 'UNLOCKED'
                    ? 'border-blue-200 bg-blue-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  {doorStatus === 'UNLOCKED' ? (
                    <DoorOpen className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  ) : (
                    <DoorClosed className="h-4 w-4 text-slate-700" aria-hidden="true" />
                  )}
                  Door Status (Simulation)
                </div>
                <p
                  data-testid="door-status-value"
                  className={`mt-2.5 font-display text-2xl font-bold tracking-tight ${
                    doorStatus === 'UNLOCKED' ? 'text-blue-900' : 'text-slate-900'
                  }`}
                >
                  {doorStatus}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {doorStatus === 'UNLOCKED'
                    ? 'Simulated latch released after valid login'
                    : 'Simulated latch secured'}
                </p>
              </div>
            </div>

            {doorStatus === 'UNLOCKED' && (
              <div className="pt-2 flex items-center justify-between gap-4">
                <p className="text-xs text-slate-500">
                  Manually re-engage the simulated door lock after entry check.
                </p>
                <button
                  type="button"
                  onClick={handleLock}
                  disabled={locking}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {locking ? 'Locking...' : 'Lock Door (Simulation)'}
                </button>
              </div>
            )}
          </section>

          {/* Latest Authenticated Employee Card */}
          <section className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Latest Evaluated Employee
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Details from the most recent authentication attempt
              </p>
            </div>

            <dl className="divide-y divide-slate-100 text-sm">
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Employee Name</dt>
                <dd className="font-semibold text-slate-900">{latest.employee_name}</dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Employee ID</dt>
                <dd className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                  {latest.employee_id}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium text-slate-800">{latest.role}</dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Authentication Method</dt>
                <dd className="font-medium text-slate-800">{latest.auth_method}</dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Authentication Result</dt>
                <dd className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                  {latest.status === 'Granted' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <ShieldX className="h-4 w-4 text-red-600" aria-hidden="true" />
                  )}
                  {latest.status} — {latest.reason}
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Evaluated At</dt>
                <dd className="font-mono text-xs text-slate-600 tabular-nums">
                  {formatDateTime(latest.created_at)}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
