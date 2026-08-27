import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSearch } from '../../context/SearchContext';
import { NotificationBell } from '../common/NotificationBell';
import {
  Zap,
  Home,
  MapPin,
  BarChart2,
  Building2,
  Users,
  User,
  Plus,
  Search,
  FileText,
  Award,
  Clock,
  Check,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Filter,
  Wrench,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers
} from 'lucide-react';

export const AppLayout = ({ children, headerTitle, headerSubtitle, onNewIssueClick, customHeaderActions }) => {
  const { user, logout } = useAuth();
  const { searchQuery, setSearchQuery, triggerRefresh } = useSearch();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('civicflow_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    if (userDropdownOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [userDropdownOpen]);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('civicflow_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    triggerRefresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const role = user?.role || 'citizen';

  // Navigation Links definition per role matching user request (Profile in sidebar, Settings removed)
  const getNavLinks = () => {
    if (role === 'admin') {
      return [
        { path: '/admin', label: 'Overview', icon: Home, exact: true },
        { path: '/admin?tab=map', label: 'Issues Map', icon: MapPin, badge: '47' },
        { path: '/admin?tab=analytics', label: 'Analytics', icon: BarChart2 },
        { path: '/admin?tab=departments', label: 'Departments', icon: Building2, badge: '8' },
        { path: '/workers', label: 'Field Workers', icon: Wrench },
        { path: '/profile', label: 'My Profile', icon: User }
      ];
    } else if (role === 'citizen') {
      return [
        { path: '/citizen', label: 'Home', icon: Home, exact: true },
        { path: '/citizen?tab=explore', label: 'Explore Issues', icon: Search },
        { path: '/submit', label: 'Report an Issue', icon: Plus },
        { path: '/citizen?tab=complaints', label: 'My Complaints', icon: FileText },
        { path: '/citizen?tab=contributions', label: 'My Contributions', icon: Award },
        { path: '/profile', label: 'My Profile', icon: User }
      ];
    } else if (role === 'officer') {
      return [
        { path: '/officer', label: 'Officer Queue', icon: Home, exact: true },
        { path: '/officer?tab=map', label: 'Department Map', icon: MapPin },
        { path: '/workers', label: 'Field Workers', icon: Wrench },
        { path: '/profile', label: 'My Profile', icon: User }
      ];
    } else if (role === 'worker') {
      return [
        { path: '/worker', label: 'My Tasks', icon: Home, exact: true },
        { path: '/worker?filter=Active', label: 'Active Work', icon: Wrench },
        { path: '/profile', label: 'My Profile', icon: User }
      ];
    }
    return [];
  };

  const navLinks = getNavLinks();

  const isLinkActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path && (!location.search || location.search === '');
    }
    if (item.path.includes('?')) {
      const [path, query] = item.path.split('?');
      return location.pathname === path && location.search.includes(query);
    }
    return location.pathname.startsWith(item.path);
  };

  const brandName = role === 'admin' ? 'CivicConnect' : 'CivicFlow';
  const brandSubtitle = role === 'admin' ? 'Admin Dashboard' : 'Smart City, Better Tomorrow';

  // Get user initials
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="app-shell">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 95
          }}
        />
      )}

      {/* Left Sidebar matching Reference Images 1 & 2 */}
      <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Brand / Logo + Toggle Button */}
        <div className="sidebar-header">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', minWidth: 0 }}>
            <div className="sidebar-brand-icon">
              <Zap size={22} fill="#ffffff" color="#ffffff" />
            </div>
            <div className="sidebar-brand-text" style={{ minWidth: 0 }}>
              <div className="sidebar-brand-title">{brandName}</div>
              <div className="sidebar-brand-sub">{brandSubtitle}</div>
            </div>
          </Link>

          <button
            onClick={toggleSidebarCollapse}
            className="sidebar-toggle-btn"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle Sidebar"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: 'none',
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b'
            }}
            className="mobile-close-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navLinks.map(item => {
            const active = isLinkActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div className="sidebar-nav-item-left">
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                  <span className="sidebar-nav-item-text">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="sidebar-badge">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Bottom: Quick Stats & User Profile Card */}
        <div className="sidebar-bottom">
          {/* Quick Stats Widget matching Image 1 */}
          <div className="sidebar-quick-stats">
            <div className="sidebar-quick-stats-title">Quick Stats</div>
            <div className="sidebar-stat-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#64748b' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }}></span>
                <span>Open</span>
              </div>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>23</span>
            </div>
            <div className="sidebar-stat-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#64748b' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }}></span>
                <span>In Progress</span>
              </div>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>15</span>
            </div>
            <div className="sidebar-stat-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#64748b' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></span>
                <span>Resolved</span>
              </div>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>234</span>
            </div>
          </div>

          {/* User Profile Card */}
          <div style={{ position: 'relative', width: '100%' }} ref={userDropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: sidebarCollapsed ? '0.45rem' : '0.6rem 0.75rem',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
              title={sidebarCollapsed ? `${user?.name || 'User'} (${user?.role || 'Citizen'})` : undefined}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                <div className="sidebar-avatar">
                  {initials}
                </div>
                <div className="sidebar-user-text" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || 'Viren Patel'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'capitalize' }}>
                    {user?.role === 'admin' ? 'Super Admin' : user?.role || 'Citizen'}
                  </div>
                </div>
              </div>
              <ChevronDown size={14} color="#94a3b8" className="sidebar-chevron" />
            </button>

            {/* User Dropdown Menu */}
            {userDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: '0.5rem',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  padding: '0.4rem',
                  zIndex: 200,
                  minWidth: '180px'
                }}
              >
                <Link
                  to="/profile"
                  onClick={() => setUserDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    color: '#334155',
                    textDecoration: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 600
                  }}
                  className="dropdown-item"
                >
                  <User size={15} /> My Profile
                </Link>
                <div style={{ height: '1px', background: '#f1f5f9', margin: '0.3rem 0' }} />
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    color: '#dc2626',
                    background: 'none',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  className="dropdown-item"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main App Content Viewport */}
      <div className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Header Bar matching Images 1 & 2 */}
        <header className="top-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 auto' }}>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="btn btn-secondary"
              style={{ padding: '0.5rem', display: 'none' }}
              aria-label="Open Sidebar Menu"
            >
              <Menu size={20} />
            </button>

            <div className="top-header-title">
              <h1>{headerTitle || (role === 'admin' ? 'Dashboard Overview' : `Good morning, ${user?.name?.split(' ')[0] || 'Viren'}!`)}</h1>
              <p>{headerSubtitle || (role === 'admin' ? 'Manage civic issues and track city maintenance' : "Let's make our city a better place together.")}</p>
            </div>
          </div>

          <div className="top-header-actions">
            {/* Search Input matching Image 1 ("Search issues, locations...") */}
            <div className="top-search-box">
              <Search
                size={16}
                color="#94a3b8"
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search issues, locations..."
                className="top-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: 0
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Custom Header Actions or Defaults */}
            {customHeaderActions}

            {/* Primary Action Button ("+ New Issue" for Admin, "+ Report an Issue" for Citizen) */}
            {role === 'admin' ? (
              <button
                onClick={onNewIssueClick || (() => navigate('/submit'))}
                className="btn btn-primary"
                style={{ padding: '0.55rem 1rem' }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>+ New Issue</span>
              </button>
            ) : role === 'citizen' ? (
              <Link
                to="/submit"
                className="btn btn-primary"
                style={{ textDecoration: 'none', padding: '0.55rem 1rem' }}
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Report Issue</span>
              </Link>
            ) : null}

            {/* Real-time Notification Bell */}
            <NotificationBell />

            {/* User Profile Avatar Circle in Top Right */}
            <Link
              to="/profile"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                flexShrink: 0
              }}
              title="My Profile"
            >
              {initials}
            </Link>
          </div>
        </header>

        {/* Page Main Content Container */}
        <main className="content-container">
          {children}
        </main>
      </div>
    </div>
  );
};
