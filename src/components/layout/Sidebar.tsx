import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HiOutlineRectangleStack,
  HiOutlineSquare3Stack3D,
  HiOutlineCog6Tooth,
  HiOutlineChartBarSquare,
  HiOutlineClock,
  HiOutlineReceiptPercent,
  HiOutlineUserGroup,
  HiOutlineBars3,
  HiOutlineXMark,
  HiOutlineLockClosed,
} from 'react-icons/hi2';
import { usePlanFeature, usePlanTier } from '@/context/LicenseContext';
import { PLAN_DISPLAY_NAMES, PLAN_COLORS } from '@/types';

const mainNav = [
  { to: '/dashboard', label: 'Dashboard', icon: HiOutlineChartBarSquare },
  { to: '/projects',  label: 'Projects',  icon: HiOutlineRectangleStack },
];

const directoryNav = [
  { to: '/vendors',  label: 'Party Directory', icon: HiOutlineUserGroup },
  { to: '/settings', label: 'Settings',         icon: HiOutlineCog6Tooth },
];

function PlanBadge({ collapsed }: { collapsed: boolean }) {
  const plan   = usePlanTier();
  const colors = PLAN_COLORS[plan];

  if (collapsed) {
    return (
      <div className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ${colors.badge} ${colors.text}`}>
        {PLAN_DISPLAY_NAMES[plan][0]}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge} ${colors.text}`}>
      {PLAN_DISPLAY_NAMES[plan]}
    </span>
  );
}

function LockedNavItem({
  label,
  to,
  icon: Icon,
  requiredPlan,
  collapsed,
}: {
  label: string;
  to: string;
  icon: React.ElementType;
  requiredPlan: string;
  collapsed: boolean;
}) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      title={collapsed ? `${label} — requires ${requiredPlan}` : undefined}
      className={`w-full sidebar-item opacity-50 cursor-pointer ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
            <HiOutlineLockClosed className="w-2.5 h-2.5" />
            {requiredPlan.toUpperCase()}
          </span>
        </>
      )}
    </button>
  );
}

function NavGroup({
  label,
  items,
  collapsed,
}: {
  label: string;
  items: typeof mainNav;
  collapsed: boolean;
}) {
  return (
    <div>
      {!collapsed && <p className="section-label px-4 pt-4 pb-2">{label}</p>}
      {collapsed && <div className="pt-3" />}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            `${isActive ? 'sidebar-item-active' : 'sidebar-item'} ${collapsed ? 'justify-center px-2' : ''}`
          }
        >
          <item.icon className="w-5 h-5 shrink-0" />
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
    </div>
  );
}

function ReportsNavGroup({ collapsed }: { collapsed: boolean }) {
  const canViewPending = usePlanFeature('pendingPayments');
  const canViewGST     = usePlanFeature('gstReport');

  return (
    <div>
      {!collapsed && <p className="section-label px-4 pt-4 pb-2">Reports</p>}
      {collapsed && <div className="pt-3" />}

      {canViewPending ? (
        <NavLink
          to="/pending-payments"
          title={collapsed ? 'Pending Payments' : undefined}
          className={({ isActive }) =>
            `${isActive ? 'sidebar-item-active' : 'sidebar-item'} ${collapsed ? 'justify-center px-2' : ''}`
          }
        >
          <HiOutlineClock className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Pending Payments</span>}
        </NavLink>
      ) : (
        <LockedNavItem
          to="/pending-payments"
          label="Pending Payments"
          icon={HiOutlineClock}
          requiredPlan="Studio"
          collapsed={collapsed}
        />
      )}

      {canViewGST ? (
        <NavLink
          to="/gst-report"
          title={collapsed ? 'GST Report' : undefined}
          className={({ isActive }) =>
            `${isActive ? 'sidebar-item-active' : 'sidebar-item'} ${collapsed ? 'justify-center px-2' : ''}`
          }
        >
          <HiOutlineReceiptPercent className="w-5 h-5 shrink-0" />
          {!collapsed && <span>GST Report</span>}
        </NavLink>
      ) : (
        <LockedNavItem
          to="/gst-report"
          label="GST Report"
          icon={HiOutlineReceiptPercent}
          requiredPlan="Studio"
          collapsed={collapsed}
        />
      )}
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="border-r flex flex-col shrink-0 overflow-y-auto transition-all duration-300 print:hidden"
      style={{
        width: collapsed ? '56px' : '240px',
        minWidth: collapsed ? '56px' : '240px',
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Logo + collapse toggle */}
      <div className={`p-3 pb-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}
            >
              <HiOutlineSquare3Stack3D className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-sm font-bold truncate"
                style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text-primary)' }}
              >
                Arch PEM
              </h2>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>Project Expense Manager</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
          style={{ color: 'var(--text-muted)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <HiOutlineBars3 className="w-4 h-4" /> : <HiOutlineXMark className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-1 pb-4 ${collapsed ? 'px-1' : 'px-3'}`}>
        <NavGroup label="Main"      items={mainNav}      collapsed={collapsed} />
        <ReportsNavGroup                                  collapsed={collapsed} />
        <NavGroup label="Directory" items={directoryNav} collapsed={collapsed} />
      </nav>

      {/* Footer — plan badge + offline indicator */}
      {!collapsed && (
        <div className="p-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div
            className="rounded-xl p-2.5"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))' }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-indigo-500" style={{ fontFamily: 'Manrope, sans-serif' }}>
                100% Offline
              </p>
              <PlanBadge collapsed={false} />
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              All data stored locally.
            </p>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="pb-3 flex justify-center">
          <PlanBadge collapsed={true} />
        </div>
      )}
    </aside>
  );
}
