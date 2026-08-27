import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest, workerHistoryService } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { Wrench, Plus, Edit3, Trash2, UserCheck, UserX, Search, Building2, Phone, Mail, RefreshCw, X, CheckCircle2, AlertTriangle, History, Calendar, MapPin, ExternalLink, Clock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const DEPARTMENTS_CACHE = { data: null };

export const WorkerManagementPage = () => {
  const { user } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // History modal
  const [historyWorker, setHistoryWorker] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', department_id: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Edit modal
  const [editWorker, setEditWorker] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', department_id: '' });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const openHistory = async (w) => {
    setHistoryWorker(w);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const data = await workerHistoryService.getWorkerHistory(w.id);
      setHistoryData(data);
    } catch (err) {
      flash(err.message || 'Failed to load field history', true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [workersRes, deptsRes] = await Promise.all([
        apiRequest('/workers'),
        DEPARTMENTS_CACHE.data
          ? Promise.resolve(DEPARTMENTS_CACHE.data)
          : apiRequest('/departments')
      ]);
      const depts = Array.isArray(deptsRes) ? deptsRes : deptsRes?.departments || [];
      DEPARTMENTS_CACHE.data = depts;
      setWorkers(workersRes.workers || []);
      setDepartments(depts);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
  };

  // ── Add Worker ──────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email || !addForm.department_id) {
      setAddError('Name, email and department are required.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...addForm, role: 'worker' })
      });
      setShowAddModal(false);
      setAddForm({ name: '', email: '', phone: '', department_id: '' });
      flash('Worker added successfully');
      await fetchData();
    } catch (err) {
      setAddError(err.message || 'Failed to add worker');
    } finally {
      setAdding(false);
    }
  };

  // ── Edit Worker ─────────────────────────────────────────────────────────────
  const openEdit = (w) => {
    setEditWorker(w);
    setEditForm({ name: w.name, phone: w.phone || '', department_id: w.department_id || '' });
    setEditError('');
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name) { setEditError('Name is required.'); return; }
    setEditing(true);
    setEditError('');
    try {
      await apiRequest(`/workers/${editWorker.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          ...(user.role === 'admin' && editForm.department_id ? { department_id: editForm.department_id } : {})
        })
      });
      setEditWorker(null);
      flash('Worker updated');
      await fetchData();
    } catch (err) {
      setEditError(err.message || 'Failed to update worker');
    } finally {
      setEditing(false);
    }
  };

  // ── Toggle Status ───────────────────────────────────────────────────────────
  const handleToggleStatus = async (w) => {
    try {
      await apiRequest(`/workers/${w.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !w.active })
      });
      flash(`${w.name} marked ${!w.active ? 'active' : 'inactive'}`);
      await fetchData();
    } catch (err) {
      flash(err.message || 'Failed to update status', true);
    }
  };

  // ── Delete Worker ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/workers/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      flash('Worker removed');
      await fetchData();
    } catch (err) {
      flash(err.message || 'Failed to delete worker', true);
    } finally {
      setDeleting(false);
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: workers.length,
    active: workers.filter(w => w.active !== false).length,
    inactive: workers.filter(w => w.active === false).length,
    byDept: departments.map(d => ({
      ...d,
      count: workers.filter(w => w.department_id === d.id).length
    })).filter(d => d.count > 0)
  }), [workers, departments]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return workers;
    const q = search.toLowerCase();
    return workers.filter(w =>
      w.name?.toLowerCase().includes(q) ||
      w.email?.toLowerCase().includes(q) ||
      w.cf_departments?.name?.toLowerCase().includes(q)
    );
  }, [workers, search]);

  const inputStyle = { width: '100%', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', background: '#fff', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wrench size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Worker Management</h1>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Manage field workers — add, assign departments, activate/deactivate</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAddModal(true); setAddError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> Add Field Worker
        </button>
      </div>

      {/* Flash messages */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Workers', value: stats.total, color: '#2563eb' },
          { label: 'Active', value: stats.active, color: '#16a34a' },
          { label: 'Inactive', value: stats.inactive, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} className="clay-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
        {stats.byDept.slice(0, 3).map(d => (
          <div key={d.id} className="clay-card" style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>{d.count}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{d.code || d.name}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by name, email or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.25rem' }}
          />
        </div>
        <button className="btn btn-secondary" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Worker Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontSize: '0.9rem' }}>Loading workers...</div>
      ) : filtered.length === 0 ? (
        <div className="clay-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Wrench size={40} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
            {search ? 'No workers match your search' : 'No field workers added yet'}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {!search && 'Click "Add Field Worker" to onboard your first field staff member.'}
          </div>
        </div>
      ) : (
        <div className="clay-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                  {['Worker', 'Department', 'Contact', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.85rem 1.1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((w, i) => {
                  const isActive = w.active !== false;
                  return (
                    <tr key={w.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '1rem 1.1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: isActive ? '#0f172a' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, flexShrink: 0 }}>
                            {w.name?.charAt(0)?.toUpperCase() || 'W'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{w.name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ID: {w.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                          <Building2 size={14} />
                          {w.cf_departments?.name || <span style={{ color: '#94a3b8', fontWeight: 400 }}>Unassigned</span>}
                        </div>
                        {w.cf_departments?.code && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>{w.cf_departments.code}</div>}
                      </td>
                      <td style={{ padding: '1rem 1.1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#475569', marginBottom: '0.2rem' }}>
                          <Mail size={12} /> {w.email}
                        </div>
                        {w.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#475569' }}>
                            <Phone size={12} /> {w.phone}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.1rem' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.3rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                          background: isActive ? '#dcfce7' : '#f1f5f9',
                          color: isActive ? '#166534' : '#64748b',
                          border: `1px solid ${isActive ? '#bbf7d0' : '#e2e8f0'}`
                        }}>
                          {isActive ? <UserCheck size={11} /> : <UserX size={11} />}
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.1rem', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {w.created_at ? new Date(w.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '1rem 1.1rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => openHistory(w)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#2563eb', borderColor: '#bfdbfe' }}
                            title="View past field work & dispatch history"
                          >
                            <History size={13} /> History
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => openEdit(w)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Edit worker"
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleToggleStatus(w)}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: isActive ? '#b45309' : '#16a34a' }}
                            title={isActive ? 'Deactivate' : 'Activate'}
                          >
                            {isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {user.role === 'admin' && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => setDeleteTarget(w)}
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#dc2626' }}
                              title="Delete worker"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Worker Modal ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="clay-card" style={{ width: '100%', maxWidth: '460px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>Add Field Worker</h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.5rem' }}>New worker account will be created with login access.</p>
            {addError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: 600 }}>{addError}</div>}
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label style={labelStyle}>Full Name *</label>
                <input style={inputStyle} type="text" placeholder="e.g. Ramesh Kumar" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Email Address *</label>
                <input style={inputStyle} type="email" placeholder="worker@civicflow.org" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Phone Number</label>
                <input style={inputStyle} type="tel" placeholder="+91 XXXXX XXXXX" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Department *</label>
                <select style={inputStyle} value={addForm.department_id} onChange={e => setAddForm({ ...addForm, department_id: e.target.value })} required>
                  <option value="">— Select Department —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={adding}>
                  {adding ? 'Adding...' : 'Add Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Worker Modal ── */}
      {editWorker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="clay-card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setEditWorker(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>Edit Worker</h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.5rem' }}>{editWorker.email}</p>
            {editError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: 600 }}>{editError}</div>}
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label style={labelStyle}>Full Name *</label>
                <input style={inputStyle} type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              {user.role === 'admin' && (
                <div className="form-group">
                  <label style={labelStyle}>Department</label>
                  <select style={inputStyle} value={editForm.department_id} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}>
                    <option value="">— No change —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditWorker(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={editing}>
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Field History Modal ── */}
      {historyWorker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="clay-card" style={{ width: '100%', maxWidth: '750px', padding: '2rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setHistoryWorker(null)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={22} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <History size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Field Work History — {historyWorker.name}
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span>{historyWorker.email}</span>
                  <span>•</span>
                  <span>{historyWorker.cf_departments?.name || 'Field Staff'}</span>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                Loading past field assignments and dispatch logs...
              </div>
            ) : historyData ? (
              <div>
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', margin: '1.25rem 0 1.5rem 0' }}>
                  <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{historyData.stats?.total_assigned || 0}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Tasks</div>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{historyData.stats?.completed || 0}</div>
                    <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>Resolved</div>
                  </div>
                  <div style={{ background: '#eff6ff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb' }}>{historyData.stats?.in_progress || 0}</div>
                    <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase' }}>Active Tasks</div>
                  </div>
                  <div style={{ background: '#faf5ff', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed' }}>{historyData.stats?.total_updates_logged || 0}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6b21a8', fontWeight: 700, textTransform: 'uppercase' }}>Field Updates</div>
                  </div>
                </div>

                {/* Section 1: Assigned Field Tasks */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Wrench size={16} color="#2563eb" /> Assigned Field Complaints ({historyData.assigned_complaints?.length || 0})
                  </h3>

                  {historyData.assigned_complaints?.length === 0 ? (
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      No field complaints assigned yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {historyData.assigned_complaints.map(c => (
                        <div key={c.id} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '240px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                              <StatusBadge status={c.status} />
                              <PriorityBadge priority={c.priority} />
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: '0.2rem' }}>{c.title}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <MapPin size={12} color="#2563eb" /> {c.address}
                            </div>
                          </div>
                          <Link to={`/complaint/${c.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none', padding: '0.4rem 0.8rem', background: '#eff6ff', borderRadius: '8px' }}>
                            View Case <ExternalLink size={13} />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Field Updates Log & GeoCam Timeline */}
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={16} color="#16a34a" /> Live Dispatch & Progress Logs ({historyData.updates_timeline?.length || 0})
                  </h3>

                  {historyData.updates_timeline?.length === 0 ? (
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      No on-site progress updates recorded yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {historyData.updates_timeline.map(u => (
                        <div key={u.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{
                                padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase',
                                background: u.update_type === 'completed' ? '#dcfce7' : u.update_type === 'in_progress' ? '#eff6ff' : '#fef3c7',
                                color: u.update_type === 'completed' ? '#166534' : u.update_type === 'in_progress' ? '#1d4ed8' : '#92400e'
                              }}>
                                {u.update_type.replace('_', ' ')}
                              </span>
                              {u.cf_complaints?.title && (
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                                  on "{u.cf_complaints.title}"
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              {new Date(u.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.3rem' }}>
                            "{u.remarks}"
                          </div>

                          {(u.geo_image_url || u.proof_image_url) && (
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <img
                                src={u.geo_image_url || u.proof_image_url}
                                alt="Field Proof"
                                style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <ShieldCheck size={13} /> GeoCam Verified Field Photo
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: '1.75rem', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setHistoryWorker(null)}>
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="clay-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} color="#dc2626" />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>Remove Worker</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{deleteTarget.name}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1.5rem' }}>
              This will permanently remove <strong>{deleteTarget.name}</strong> and unassign them from all active complaints. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Removing...' : 'Remove Worker'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
