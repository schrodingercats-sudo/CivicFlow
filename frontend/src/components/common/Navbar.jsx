import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import {
  Shield,
  LogOut,
  FileText,
  LayoutDashboard,
  PlusCircle,
  User,
  Wrench,
  Menu,
  X,
  ChevronDown,
  Building2,
  CheckCircle2
} from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when route changes
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [dropdownOpen]);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return { label: 'Administrator', bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
      case 'officer':
        return { label: 'Dept Officer', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' };
      case 'worker':
        return { label: 'Field Worker', bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
      default:
        return { label: 'Citizen', bg: '#f1f5f9', color: '#334155', border: '#e2e8f0' };
    }
  };

  return (
    <nav className="nav-container">
      {/* Brand / Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: '0 4px 6px rgba(15, 23, 42, 0.15)',
          flexShrink: 0
        }}>
          <Shield size={20} fontWeight="bold" />
        </div>
        <div>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a' }}>
            Civic<span style={{ color: '#2563eb' }}>Flow</span>
          </span>
          <span className="nav-brand-sub" style={{ display: 'block', fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '-2px' }}>
            Smart Redressal
          </span>
        </div>
      </Link>

      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Desktop Direct Quick Links (hidden on mobile) */}
          <div className="desktop-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {user.role === 'citizen' && (
              <>
                <Link to="/submit" className="btn btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', textDecoration: 'none' }}>
                  <PlusCircle size={15} /> Submit Issue
                </Link>
                <Link to="/citizen" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', padding: '0.45rem 0.6rem' }}>
                  <FileText size={16} /> My Complaints
                </Link>
              </>
            )}

            {user.role === 'officer' && (
              <>
                <Link to="/officer" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', padding: '0.45rem 0.6rem' }}>
                  <LayoutDashboard size={16} /> Officer Queue
                </Link>
                <Link to="/workers" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', padding: '0.45rem 0.6rem' }}>
                  <Wrench size={16} /> Workers
                </Link>
              </>
            )}

            {user.role === 'worker' && (
              <Link to="/worker" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', padding: '0.45rem 0.6rem' }}>
                <Wrench size={16} /> My Tasks
              </Link>
            )}

            {user.role === 'admin' && (
              <>
                <Link to="/admin" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', padding: '0.45rem 0.6rem' }}>
                  <LayoutDashboard size={16} /> Admin Dashboard
                </Link>
                <Link to="/workers" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', padding: '0.45rem 0.6rem' }}>
                  <Wrench size={16} /> Workers
                </Link>
              </>
            )}
          </div>

          {/* Real-time Notification Bell */}
          <NotificationBell />

          {/* Unified User & Tools Dropdown Menu */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="btn btn-secondary"
              style={{
                padding: '0.4rem 0.65rem',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                border: dropdownOpen ? '1px solid #2563eb' : '1px solid #e2e8f0',
                background: dropdownOpen ? '#eff6ff' : '#ffffff',
                cursor: 'pointer'
              }}
              aria-label="Navigation & User Menu"
              aria-expanded={dropdownOpen}
            >
              {/* User Avatar Circle */}
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#0f172a',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
                flexShrink: 0
              }}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>

              {/* Desktop Name snippet */}
              <span className="desktop-user-name" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name?.split(' ')[0] || 'Menu'}
              </span>

              {dropdownOpen ? <X size={15} color="#2563eb" /> : <ChevronDown size={14} color="#64748b" />}
            </button>

            {/* Dropdown Menu Overlay Card */}
            {dropdownOpen && (
              <div
                className="clay-card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: '270px',
                  padding: '0.75rem 0',
                  zIndex: 10000,
                  background: '#ffffff',
                  borderRadius: '14px',
                  boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.08)',
                  animation: 'fadeIn 0.18s ease-out'
                }}
              >
                {/* User Identity Header */}
                <div style={{ padding: '0.6rem 1.1rem 0.8rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.2 }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {(() => {
                      const badge = getRoleBadge(user.role);
                      return (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {badge.label}
                        </span>
                      );
                    })()}
                    {user.cf_departments && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #e2e8f0'
                      }}>
                        <Building2 size={11} /> {user.cf_departments.code || user.cf_departments.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dashboard & Workspace Navigation Section */}
                <div style={{ padding: '0.4rem 0.5rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.4rem 0.6rem 0.2rem' }}>
                    Dashboard & Tools
                  </div>

                  {user.role === 'citizen' && (
                    <>
                      <Link
                        to="/submit"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '8px',
                          color: '#2563eb',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          textDecoration: 'none',
                          background: '#eff6ff',
                          marginBottom: '0.2rem'
                        }}
                      >
                        <PlusCircle size={16} /> File New Complaint
                      </Link>
                      <Link
                        to="/citizen"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '8px',
                          color: '#334155',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          textDecoration: 'none'
                        }}
                      >
                        <FileText size={16} color="#64748b" /> My Complaints
                      </Link>
                    </>
                  )}

                  {user.role === 'officer' && (
                    <>
                      <Link
                        to="/officer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '8px',
                          color: '#334155',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          textDecoration: 'none'
                        }}
                      >
                        <LayoutDashboard size={16} color="#2563eb" /> Officer Queue
                      </Link>
                      <Link
                        to="/workers"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '8px',
                          color: '#334155',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          textDecoration: 'none'
                        }}
                      >
                        <Wrench size={16} color="#7c3aed" /> Field Workers
                      </Link>
                    </>
                  )}

                  {user.role === 'worker' && (
                    <Link
                      to="/worker"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '8px',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        textDecoration: 'none'
                      }}
                    >
                      <Wrench size={16} color="#d97706" /> My Field Tasks
                    </Link>
                  )}

                  {user.role === 'admin' && (
                    <>
                      <Link
                        to="/admin"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '8px',
                          color: '#334155',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          textDecoration: 'none'
                        }}
                      >
                        <LayoutDashboard size={16} color="#dc2626" /> Admin Dashboard
                      </Link>
                      <Link
                        to="/workers"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '8px',
                          color: '#334155',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          textDecoration: 'none'
                        }}
                      >
                        <Wrench size={16} color="#7c3aed" /> Worker Management
                      </Link>
                    </>
                  )}
                </div>

                {/* Account Section */}
                <div style={{ padding: '0.4rem 0.5rem', borderTop: '1px solid #f1f5f9' }}>
                  <Link
                    to="/profile"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '8px',
                      color: '#334155',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      textDecoration: 'none'
                    }}
                  >
                    <User size={16} color="#64748b" /> Account Profile
                  </Link>

                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '8px',
                      color: '#dc2626',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginTop: '0.1rem',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <LogOut size={16} color="#dc2626" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/login" className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', textDecoration: 'none' }}>
            Log In
          </Link>
          <Link to="/register" className="btn btn-primary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', textDecoration: 'none' }}>
            Register
          </Link>
        </div>
      )}
    </nav>
  );
};
