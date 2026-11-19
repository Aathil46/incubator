import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import type { DashboardSummary } from '../shared/types';
import { formatDateTime } from '../utils/formatters';
import { AccessStatusLabel } from './StatusBadge';
import type { NavSectionId } from './TopNav';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onNavigate: (section: NavSectionId) => void;
}

export function DashboardView({
  summary,
  loading,
  error,
  onRetry,
  onNavigate,
}: DashboardViewProps) {
  if (loading && !summary) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm h-28 animate-pulse"
            >
              <div className="h-3.5 w-28 bg-slate-200 rounded" />
              <div className="mt-4 h-7 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm h-72 animate-pulse" />
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Unable to load dashboard data
            </h2>
            <p className="mt-1 text-sm text-slate-600">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const maxDailyTotal = Math.max(
    1,
    ...summary.dailyStats.map((d) => d.granted + d.denied),
  );
  const totalLogs = summary.successfulLogins + summary.failedLogins;

  const kpiCards = [
    {
      label: 'Total Employees',
      value: summary.totalEmployees,
      detail: `${summary.inactiveEmployees} inactive account${summary.inactiveEmployees === 1 ? '' : 's'}`,
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Active Employees',
      value: summary.activeEmployees,
      detail: 'Eligible for room access',
      icon: UserCheck,
      iconBg: 'bg-sky-50 text-sky-700',
    },
    {
      label: 'Successful Logins',
      value: summary.successfulLogins,
      detail: `${summary.grantRatePercent}% approval rate`,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Failed Login Attempts',
      value: summary.failedLogins,
      detail: 'Rejected or inactive attempts',
      icon: ShieldAlert,
      iconBg: 'bg-red-50 text-red-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Security Overview
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Hospital smart incubator room staffing, password authentication activity, and access metrics.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 whitespace-nowrap transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => onNavigate('employee-auth')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white whitespace-nowrap transition-colors"
          >
            Authenticate Employee
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* KPI Summary Grid */}
      <section aria-label="Summary Metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <p className="mt-2 font-display text-3xl font-semibold text-slate-900 tabular-nums">
                  {card.value}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">{card.detail}</p>
              </div>
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${card.iconBg}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          );
        })}
      </section>

      {/* Statistics & Overview Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Login Statistics (7-day bar view) */}
        <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Login Statistics
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily granted vs. denied authentication attempts over the past 7 days
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#1D4ED8]" aria-hidden="true" />
                Granted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-500" aria-hidden="true" />
                Denied
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-3 items-end h-44 pt-4 border-b border-slate-100 pb-3">
            {summary.dailyStats.map((day) => {
              const grantedHeight = Math.round((day.granted / maxDailyTotal) * 100);
              const deniedHeight = Math.round((day.denied / maxDailyTotal) * 100);
              return (
                <div key={day.date} className="flex flex-col items-center h-full justify-end gap-2">
                  <div className="w-full max-w-[44px] flex-1 flex items-end justify-center gap-1">
                    {day.granted > 0 ? (
                      <div
                        className="w-4 rounded-t bg-[#1D4ED8] transition-all"
                        style={{ height: `${Math.max(grantedHeight, 12)}%` }}
                        title={`${day.label}: ${day.granted} granted`}
                      />
                    ) : (
                      <div
                        className="w-4 h-1 rounded-full bg-slate-200"
                        title={`${day.label}: 0 granted`}
                      />
                    )}
                    {day.denied > 0 ? (
                      <div
                        className="w-4 rounded-t bg-red-500 transition-all"
                        style={{ height: `${Math.max(deniedHeight, 12)}%` }}
                        title={`${day.label}: ${day.denied} denied`}
                      />
                    ) : (
                      <div
                        className="w-4 h-1 rounded-full bg-slate-200"
                        title={`${day.label}: 0 denied`}
                      />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                      {day.label}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {day.granted}/{day.denied}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Access Status Overview */}
        <section className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Access Status Overview
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cumulative decision distribution &amp; authorized roles
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Granted vs. Denied</span>
                <span className="font-mono text-xs text-slate-700 tabular-nums">
                  {totalLogs} total attempts
                </span>
              </div>
              <div className="h-3 w-full rounded-md bg-slate-100 overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full transition-all"
                  style={{
                    width: `${totalLogs > 0 ? (summary.successfulLogins / totalLogs) * 100 : 0}%`,
                  }}
                />
                <div
                  className="bg-red-500 h-full transition-all"
                  style={{
                    width: `${totalLogs > 0 ? (summary.failedLogins / totalLogs) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                <span>Granted: {summary.successfulLogins}</span>
                <span>Denied: {summary.failedLogins}</span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-3">
                Authorized Staff by Role
              </p>
              <div className="space-y-2.5">
                {summary.roleBreakdown.map((item) => (
                  <div key={item.role} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.role}</span>
                    <span className="font-mono text-xs text-slate-600 tabular-nums">
                      {item.active} active / {item.total} total
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('access-control')}
            className="mt-6 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 px-4 py-2 text-xs font-semibold text-slate-800 transition-colors"
          >
            Inspect Access Control Decision
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </section>
      </div>

      {/* Recent Access Activity */}
      <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recent Access Activity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest password authentication events recorded server-side
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('access-history')}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
          >
            View Full History
          </button>
        </div>

        {summary.recentLogs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No access events recorded yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Authenticate an employee to record the first smart incubator room entry log.
            </p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {summary.recentLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-slate-900">{log.employee_name}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {log.employee_id} · {log.role}
                      </p>
                    </div>
                    <AccessStatusLabel status={log.status} />
                  </div>
                  <p className="font-mono text-xs text-slate-500 tabular-nums">
                    {formatDateTime(log.created_at)} · {log.auth_method}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-5">Date &amp; Time</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Auth Method</th>
                    <th className="py-3 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {summary.recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                        {log.employee_id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {log.employee_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{log.role}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{log.auth_method}</td>
                      <td className="py-3 px-5 text-right">
                        <AccessStatusLabel status={log.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
