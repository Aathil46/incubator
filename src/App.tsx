import { useCallback, useEffect, useState } from 'react';
import { AccessControlView } from './components/AccessControlView';
import { AccessHistoryView } from './components/AccessHistoryView';
import { AdminPanelView } from './components/AdminPanelView';
import { DashboardView } from './components/DashboardView';
import { EmployeeAuthView } from './components/EmployeeAuthView';
import { NAV_ITEMS, Sidebar } from './components/Sidebar';
import { TopNav, type NavSectionId } from './components/TopNav';
import type {
  AccessControlState,
  DashboardSummary,
  SessionUser,
} from './shared/types';
import { api } from './utils/api';

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSectionId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [accessControlState, setAccessControlState] = useState<AccessControlState | null>(null);
  const [accessControlLoading, setAccessControlLoading] = useState(true);
  const [accessControlError, setAccessControlError] = useState<string | null>(null);

  const [logsRefreshTrigger, setLogsRefreshTrigger] = useState(0);

  const loadSession = useCallback(async () => {
    try {
      const res = await api.getSession();
      setSessionUser(res.user);
    } catch {
      setSessionUser(null);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await api.getDashboard();
      setDashboardSummary(res.summary);
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadAccessControl = useCallback(async () => {
    setAccessControlLoading(true);
    setAccessControlError(null);
    try {
      const res = await api.getAccessControl();
      setAccessControlState(res.state);
    } catch (err) {
      setAccessControlError(
        err instanceof Error ? err.message : 'Unable to load access control state.',
      );
    } finally {
      setAccessControlLoading(false);
    }
  }, []);

  const refreshAllData = useCallback(() => {
    loadDashboard();
    loadAccessControl();
    setLogsRefreshTrigger((n) => n + 1);
  }, [loadDashboard, loadAccessControl]);

  useEffect(() => {
    loadSession();
    loadDashboard();
    loadAccessControl();
  }, [loadSession, loadDashboard, loadAccessControl]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      setSessionUser(null);
    }
  };

  const handleLockSimulation = async () => {
    const res = await api.lockSimulatedDoor();
    setAccessControlState(res.state);
  };

  const activeNav = NAV_ITEMS.find((item) => item.id === activeSection) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#EEF3F9] text-slate-900">
      <TopNav
        activeSectionTitle={activeNav.label}
        sessionUser={sessionUser}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onNavigateAuth={() => setActiveSection('employee-auth')}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeSection={activeSection}
          onSelectSection={(id) => {
            setActiveSection(id);
            if (id === 'dashboard') loadDashboard();
            if (id === 'access-control') loadAccessControl();
          }}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {activeSection === 'dashboard' && (
              <DashboardView
                summary={dashboardSummary}
                loading={dashboardLoading}
                error={dashboardError}
                onRetry={loadDashboard}
                onNavigate={setActiveSection}
              />
            )}

            {activeSection === 'employee-auth' && (
              <EmployeeAuthView
                sessionUser={sessionUser}
                onAuthSuccess={(user) => {
                  setSessionUser(user);
                  refreshAllData();
                }}
                onAuthRecorded={refreshAllData}
                onLogout={handleLogout}
                onNavigate={setActiveSection}
              />
            )}

            {activeSection === 'access-control' && (
              <AccessControlView
                state={accessControlState}
                loading={accessControlLoading}
                error={accessControlError}
                onRefresh={loadAccessControl}
                onLockSimulation={handleLockSimulation}
                onNavigate={setActiveSection}
              />
            )}

            {activeSection === 'access-history' && (
              <AccessHistoryView
                sessionUser={sessionUser}
                refreshTrigger={logsRefreshTrigger}
                onLogsChanged={refreshAllData}
              />
            )}

            {activeSection === 'admin-panel' && (
              <AdminPanelView
                sessionUser={sessionUser}
                onAdminSessionEstablished={(user) => {
                  setSessionUser(user);
                  refreshAllData();
                }}
                onEmployeesChanged={refreshAllData}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
