import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Shield, ArrowRight, UserCheck, ShieldAlert, Briefcase } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (emailToSubmit) => {
    setError('');
    setSubmitting(true);
    try {
      const data = await login(emailToSubmit || email);
      if (data.user.role === 'citizen') navigate('/citizen');
      else if (data.user.role === 'officer') navigate('/officer');
      else if (data.user.role === 'admin') navigate('/admin');
      else navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto' }}>
      <div className="clay-card" style={{ padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: '#0f172a',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: '1rem',
            boxShadow: '0 6px 12px rgba(15, 23, 42, 0.2)'
          }}>
            <Shield size={28} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>Welcome to CivicFlow</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Sign in to track or manage civic complaints
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            fontWeight: 600
          }}>
            {error}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. pratham.citizen@civicflow.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.85rem' }}
            disabled={submitting}
          >
            {submitting ? 'Authenticating...' : 'Sign In'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 800, marginBottom: '0.85rem', textAlign: 'center' }}>
            Demo Quick Login
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              onClick={() => handleLogin('pratham.citizen@civicflow.org')}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.85rem' }}
            >
              <UserCheck size={16} color="#0f172a" /> Citizen Demo (Pratham Solanki)
            </button>
            <button
              onClick={() => handleLogin('officer.roads@civicflow.org')}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.85rem' }}
            >
              <Briefcase size={16} color="#0f172a" /> Officer Demo (Roads Dept)
            </button>
            <button
              onClick={() => handleLogin('admin@civicflow.org')}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.85rem' }}
            >
              <ShieldAlert size={16} color="#0f172a" /> Admin Demo (System Admin)
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
          New citizen? <Link to="/register" style={{ color: '#0f172a', fontWeight: 800 }}>Register Account</Link>
        </div>
      </div>
    </div>
  );
};
