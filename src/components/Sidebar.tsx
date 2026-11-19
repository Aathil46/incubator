import {
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { NavSectionId } from './TopNav';

export interface NavItem {
  id: NavSectionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'employee-auth', label: 'Employee Authentication', icon: KeyRound },
  { id: 'access-control', label: 'Access Control', icon: ShieldCheck },
  { id: 'access-history', label: 'Access History', icon: ClipboardList },
  { id: 'admin-panel', label: 'Admin Panel', icon: Users },
];

interface SidebarProps {
  activeSection: NavSectionId;
  onSelectSection: (id: NavSectionId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleSelect = (id: NavSectionId) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/90">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between lg:hidden border-b border-slate-100">
        <span className="font-display text-sm font-semibold text-slate-900">
          Navigation
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Main Navigation" className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-blue-700' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-100 text-xs text-slate-500">
        <p className="font-medium text-slate-700">NICU Security Perimeter</p>
        <p className="mt-0.5">Employee ID &amp; Password Auth</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 min-h-[calc(100vh-4rem)]">
        <div className="sticky top-16 h-[calc(100vh-4rem)]">{navContent}</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
          />
          <aside className="relative z-50 w-72 max-w-[82vw] h-full shadow-xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
