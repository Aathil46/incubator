import { CheckCircle2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import type { AccessStatus } from '../shared/types';

export function AccessStatusLabel({ status }: { status: AccessStatus }) {
  if (status === 'Granted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/80 whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        Granted
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 border border-red-200/80 whitespace-nowrap">
      <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" aria-hidden="true" />
      Denied
    </span>
  );
}

export function AccountStatusLabel({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/80 whitespace-nowrap">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200 whitespace-nowrap">
      <ShieldAlert className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      Inactive
    </span>
  );
}
