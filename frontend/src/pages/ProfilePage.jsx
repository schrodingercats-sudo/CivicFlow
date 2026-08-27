import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AppLayout } from '../components/layout/AppLayout';
import { User, Mail, Phone, Shield, Building2, Save, Check, ArrowLeft } from 'lucide-react';
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

  const role = user?.role || 'citizen';
  const dashboardLink = role === 'admin' ? '/admin' : role === 'officer' ? '/officer' : role === 'worker' ? '/worker' : '/citizen';

  return (
    <AppLayout
      headerTitle="Account Profile"
      headerSubtitle="Manage your personal credentials, contact numbers & role permissions"
    >
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to={dashboardLink} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        <div className="civic-card" style={{ padding: '2.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
            }}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{user.name}</h2>
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
            <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Check size={16} strokeWidth={2.8} /> {success}
            </div>
          )}

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>
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
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};
