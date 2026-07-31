import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { Shield, LogOut, FileText, LayoutDashboard, PlusCircle } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="nav-container">
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
          <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a' }}>
            Civic<span style={{ color: '#2563eb' }}>Flow</span>
          </span>
          <span className="nav-brand-sub" style={{ display: 'block', fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '-2px' }}>
            AI Smart Complaints
          </span>
        </div>
      </Link>

      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user.role === 'citizen' && (
            <>
              <Link to="/submit" className="btn btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                <PlusCircle size={15} /> <span className="nav-links-text">Submit Issue</span>
              </Link>
              <Link to="/citizen" className="nav-links-text" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                <FileText size={16} /> My Complaints
              </Link>
            </>
          )}

          {user.role === 'officer' && (
            <Link to="/officer" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
              <LayoutDashboard size={16} /> <span className="nav-links-text">Officer Queue</span>
            </Link>
          )}

          {user.role === 'admin' && (
            <Link to="/admin" style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
              <LayoutDashboard size={16} /> <span className="nav-links-text">Admin Dashboard</span>
            </Link>
          )}

          <NotificationBell />

          <div className="nav-divider" style={{ width: '1px', height: '20px', background: '#cbd5e1' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="nav-user-text" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'capitalize' }}>
                {user.role} {user.cf_departments ? `(${user.cf_departments.code})` : ''}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '0.45rem', borderRadius: '8px' }}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
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
