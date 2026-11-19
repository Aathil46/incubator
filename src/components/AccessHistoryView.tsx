import {
  AlertTriangle,
  ClipboardList,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AccessLogEntry, SessionUser } from '../shared/types';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/formatters';
import { AccessStatusLabel } from './StatusBadge';

interface AccessHistoryViewProps {
  sessionUser: SessionUser | null;
  refreshTrigger: number;
  onLogsChanged: () => void;
}

const STATUS_FILTERS = ['All', 'Granted', 'Denied'] as const;

export function AccessHistoryView({
  sessionUser,
  refreshTrigger,
  onLogsChanged,
}: AccessHistoryViewProps) {
  const isAdmin = sessionUser?.role === 'Admin';
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All');

  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAccessLogs({ search, status: statusFilter });
      setLogs(res.logs);
      setTotalCount(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch access history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, statusFilter, refreshTrigger]);

  const handleDeleteLog = async (id: string) => {
    setActionError(null);
    setDeletingId(id);
    try {
      await api.deleteAccessLog(id);
      await fetchLogs();
      onLogsChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete access log.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllLogs = async () => {
    setActionError(null);
    try {
      await api.clearAccessLogs();
      setConfirmClearAll(false);
      await fetchLogs();
      onLogsChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to clear access logs.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
            Access History
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Audit trail of all incubator room password and passkey authentication attempts, ordered newest first.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchLogs}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Refresh
          </button>

          {isAdmin && totalCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 px-3.5 py-2 text-sm font-medium text-red-800 whitespace-nowrap transition-colors"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear All Logs
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search Bar */}
      <section className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search access history by Employee ID or Name"
            placeholder="Search by Employee ID or Name..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4">
          <div
            role="group"
            aria-label="Filter access logs by status"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {STATUS_FILTERS.map((status) => {
              const active = statusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>

          <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
            {logs.length} of {totalCount}
          </span>
        </div>
      </section>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Table Card */}
      <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading access logs">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={fetchLogs}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="h-9 w-9 text-slate-400 mx-auto" aria-hidden="true" />
            <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
              No matching access logs
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {search || statusFilter !== 'All'
                ? 'Try clearing your search query or changing the status filter.'
                : 'Authentication attempts will appear here automatically.'}
            </p>
            {(search || statusFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('All');
                }}
                className="mt-4 inline-flex items-center rounded-lg bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {logs.map((log) => (
                <div key={log.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">
                        {log.employee_name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {log.employee_id} · {log.role}
                      </p>
                    </div>
                    <AccessStatusLabel status={log.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="font-mono tabular-nums">
                      {formatDateTime(log.created_at)} · {log.auth_method}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLog(log.id)}
                        disabled={deletingId === log.id}
                        aria-label={`Delete access log for ${log.employee_id} at ${formatDateTime(log.created_at)}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-5">Date &amp; Time</th>
                    <th className="py-3.5 px-4">Employee ID</th>
                    <th className="py-3.5 px-4">Employee Name</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Authentication Method</th>
                    <th className="py-3.5 px-4">Status</th>
                    {isAdmin && <th className="py-3.5 px-5 text-right">Manage</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {logs.map((log) => (
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
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {log.auth_method}
                      </td>
                      <td className="py-3 px-4">
                        <AccessStatusLabel status={log.status} />
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log.id)}
                            disabled={deletingId === log.id}
                            aria-label={`Delete access log for ${log.employee_id} at ${formatDateTime(log.created_at)}`}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {!isAdmin && (
        <p className="text-xs text-slate-500">
          Log deletion and audit management are restricted to authorized Administrators.
        </p>
      )}

      {/* Clear All Confirmation Dialog */}
      {confirmClearAll && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-logs-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
            <h2 id="clear-logs-title" className="font-display text-lg font-semibold text-slate-900">
              Clear All Access Logs
            </h2>
            <p className="text-sm text-slate-600">
              This will permanently remove all {totalCount} access history records from the database. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllLogs}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white"
              >
                Confirm Clear Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
