import { LogIn, LogOut, Menu, Shield } from 'lucide-react';
import type { SessionUser } from '../shared/types';

export type NavSectionId =
  | 'dashboard'
  | 'employee-auth'
  | 'access-control'
  | 'access-history'
  | 'admin-panel';

interface TopNavProps {
  activeSectionTitle: string;
  sessionUser: SessionUser | null;
  onOpenMobileMenu: () => void;
  onNavigateAuth: () => void;
  onLogout: () => void;
}

export function TopNav({
  activeSectionTitle,
  sessionUser,
  onOpenMobileMenu,
  onNavigateAuth,
  onLogout,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-[#0B2545] text-white border-b border-[#143A66] shadow-sm">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-6">
        {/* Zone 1: Brand mark */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg text-blue-100 hover:bg-[#143A66] focus-visible:outline-2 focus-visible:outline-white transition-colors"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D4ED8] text-white shrink-0">
              <Shield className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-sm sm:text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0">
              Smart Incubator Room
            </span>
          </div>
        </div>

        {/* Zone 2: Active section breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-sm text-blue-100/90 whitespace-nowrap">
          <span>Hospital Access Management</span>
          <span aria-hidden="true" className="text-blue-300/60">
            /
          </span>
          <span className="font-medium text-white">{activeSectionTitle}</span>
        </div>

        {/* Zone 3: Primary session control */}
        <div className="flex items-center gap-3 shrink-0">
          {sessionUser ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-blue-100 whitespace-nowrap">
                <span className="font-medium text-white">{sessionUser.full_name}</span>
                <span aria-hidden="true">·</span>
                <span>{sessionUser.role}</span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#163B6B] hover:bg-[#1E4B85] border border-blue-400/25 px-3.5 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-white"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onNavigateAuth}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#2563EB] px-4 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-white"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Employee Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
