import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearch } from '../context/SearchContext';
import { apiRequest, workerHistoryService } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Wrench,
  Plus,
  Edit3,
  Trash2,
  UserCheck,
  UserX,
  Search,
  Building2,
  Phone,
  Mail,
  RefreshCw,
  X,
  Check,
  CheckCircle2,
  AlertTriangle,
  Users,
  History,
  Calendar,
  MapPin,
  ExternalLink,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DEPARTMENTS_CACHE = { data: null };

export const WorkerManagementPage = () => {
  const { user } = useAuth();
  const { searchQuery, refreshKey } = useSearch();

  const [workers, setWorkers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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
  }, [refreshKey]);

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

  const stats = useMemo(() => ({
    total: workers.length,
    active: workers.filter(w => w.active !== false).length,
    inactive: workers.filter(w => w.active === false).length,
    byDept: departments.map(d => ({
      ...d,
      count: workers.filter(w => w.department_id === d.id).length
    })).filter(d => d.count > 0)
  }), [workers, departments]);

  const filtered = useMemo(() => {
    return workers.filter(w => {
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = w.name?.toLowerCase().includes(q);
        const matchesEmail = w.email?.toLowerCase().includes(q);
        const matchesDept = w.cf_departments?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesDept) return false;
      }
      if (deptFilter !== 'all' && w.department_id !== deptFilter) return false;
      if (statusFilter === 'active' && w.active === false) return false;
      if (statusFilter === 'inactive' && w.active !== false) return false;
      return true;
    });
  }, [workers, searchQuery, deptFilter, statusFilter]);

  return (
    <AppLayout
      headerTitle="Worker Management"
      headerSubtitle="Manage on-ground field workforce, department allocations & dispatch readiness"
      onNewIssueClick={() => { setShowAddModal(true); setAddError(''); }}
    >
      {/* Messages */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Check size={16} strokeWidth={2.8} /> {success}
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Workers</span>
            <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-value">{stats.total}</div>
          <div className="kpi-footer">Total on staff</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="kpi-header">
            <span className="kpi-title">Active / Ready</span>
            <div className="kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{stats.active}</div>
          <div className="kpi-footer">Ready for field dispatch</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="kpi-header">
            <span className="kpi-title">Inactive / Off Duty</span>
            <div className="kpi-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <UserX size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>{stats.inactive}</div>
          <div className="kpi-footer">Deactivated accounts</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="kpi-header">
            <span className="kpi-title">Departments</span>
            <div className="kpi-icon-box" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#7c3aed' }}>{departments.length}</div>
          <div className="kpi-footer">Municipal sectors</div>
        </div>
      </div>

      {/* Table Controls & Filter Bar */}
      <div className="table-card">
        <div className="table-header-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Field Staff Directory</h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: '#f1f5f9', color: '#475569' }}>
              {filtered.length} total
            </span>

            {/* Quick Status Tabs */}
            <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.5rem' }}>
              {[
                { label: 'All', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' }
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid',
                    cursor: 'pointer',
                    background: statusFilter === tab.value ? '#0f172a' : '#ffffff',
                    color: statusFilter === tab.value ? '#ffffff' : '#475569',
                    borderColor: statusFilter === tab.value ? '#0f172a' : '#e2e8f0',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                fontWeight: 600,
                color: '#334155'
              }}
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <button
              onClick={() => { setShowAddModal(true); setAddError(''); }}
              className="btn btn-primary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            >
              <Plus size={14} /> Add Worker
            </button>
          </div>
        </div>

        {/* Workers Table */}
        <div className="table-scroll-wrapper" style={{ maxHeight: '480px' }}>
          <table className="civic-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Worker</th>
                <th style={{ width: '25%' }}>Department</th>
                <th style={{ width: '22%' }}>Contact</th>
                <th style={{ width: '13%' }}>Status</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                    <div>Loading workers directory...</div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
                    <Wrench size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>No workers found</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Try adjusting your search or click "Add Worker" to onboard staff.</div>
                  </td>
                </tr>
              ) : (
                filtered.map(w => {
                  const isActive = w.active !== false;
                  return (
                    <tr key={w.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: isActive ? '#0f172a' : '#94a3b8',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            {w.name?.charAt(0)?.toUpperCase() || 'W'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{w.name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ID: {w.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                          <Building2 size={14} color="#2563eb" />
                          {w.cf_departments?.name || <span style={{ color: '#94a3b8' }}>Unassigned</span>}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Mail size={12} /> {w.email}
                        </div>
                        {w.phone && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Phone size={12} /> {w.phone}
                          </div>
                        )}
                      </td>

                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: isActive ? '#dcfce7' : '#f1f5f9',
                          color: isActive ? '#15803d' : '#64748b',
                          border: `1px solid ${isActive ? '#bbf7d0' : '#e2e8f0'}`
                        }}>
                          {isActive ? <Check size={12} strokeWidth={2.8} /> : <X size={12} strokeWidth={2.8} />}
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => openHistory(w)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#2563eb', borderColor: '#bfdbfe' }}
                            title="View past field work & dispatch history"
                          >
                            <History size={13} /> History
                          </button>
                          <button
                            onClick={() => openEdit(w)}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(w)}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: isActive ? '#d97706' : '#16a34a' }}
                            title={isActive ? 'Deactivate' : 'Activate'}
                          >
                            {isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>
                          {user.role === 'admin' && (
                            <button
                              onClick={() => setDeleteTarget(w)}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#dc2626' }}
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="civic-card" style={{ width: '100%', maxWidth: '440px', padding: '2rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Add Field Worker</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>Create account for on-ground staff member.</p>
            {addError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: 600 }}>{addError}</div>}
            
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" type="text" placeholder="e.g. Ramesh Kumar" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input className="form-input" type="email" placeholder="worker@civicflow.org" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" type="tel" placeholder="+91 XXXXX XXXXX" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select className="form-select" value={addForm.department_id} onChange={e => setAddForm({ ...addForm, department_id: e.target.value })} required>
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

      {/* Edit Worker Modal */}
      {editWorker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="civic-card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Edit Worker</h2>
              <button onClick={() => setEditWorker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>{editWorker.email}</p>
            {editError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem', fontWeight: 600 }}>{editError}</div>}
            
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              {user.role === 'admin' && (
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={editForm.department_id} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}>
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

      {/* Delete Modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="civic-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>Remove Worker</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{deleteTarget.name}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.5rem' }}>
              This will permanently remove <strong>{deleteTarget.name}</strong> from field dispatch queues.
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
    </AppLayout>
  );
};
