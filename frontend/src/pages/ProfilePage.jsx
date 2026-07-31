import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, Mail, Phone, Shield, Building2, Save, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  if (!user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      await updateProfile({ name, phone });
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '680px', margin: '1.5rem auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to={user.role === 'admin' ? '/admin' : user.role === 'officer' ? '/officer' : '/citizen'} className="btn btn-secondary" style={{ padding: '0.5rem 0.85rem' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      <div className="clay-card" style={{ padding: '2.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            fontWeight: 800,
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.25)'
          }}>
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>

          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{user.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: '#0f172a', color: '#ffffff', textTransform: 'capitalize' }}>
                <Shield size={12} /> {user.role} Account
              </span>
              {user.cf_departments && (
                <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                  <Building2 size={12} /> {user.cf_departments.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.85rem 1.15rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} color="#166534" /> {success}
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.85rem 1.15rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <User size={15} /> Full Name
            </label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Mail size={15} /> Email Address (Official Account ID)
            </label>
            <input
              type="email"
              className="form-input"
              value={user.email}
              disabled
              style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Email address is your unique system identifier and cannot be changed.</span>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={15} /> Contact Phone Number
            </label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Critical for municipal officers & admins to reach you regarding location clarification or emergency status updates.</span>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving Profile...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};
