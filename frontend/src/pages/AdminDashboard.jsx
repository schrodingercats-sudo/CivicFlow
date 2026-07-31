import React, { useState, useEffect } from 'react';
import { complaintService } from '../services/complaint.service';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { Shield, Building2, BarChart2, Edit, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [reassignModalItem, setReassignModalItem] = useState(null);
  const [selectedDept, setSelectedDept] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, complaintsRes, deptsRes] = await Promise.all([
        complaintService.getAdminStats(),
        complaintService.getComplaints({ limit: 50 }),
        complaintService.getDepartments()
      ]);
      setStats(statsRes);
      setComplaints(complaintsRes.complaints || []);
      setDepartments(deptsRes || []);
    } catch (err) {
      console.error('Failed to load admin metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignModalItem || !selectedDept) return;

    setReassigning(true);
    try {
      await complaintService.updateStatus(reassignModalItem.id, {
        department_id: selectedDept,
        remarks: 'Department manually reassigned by Administrator'
      });
      setReassignModalItem(null);
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to reassign department');
    } finally {
      setReassigning(false);
    }
  };

  const handleDeleteComplaint = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await complaintService.deleteComplaint(deleteId);
      setDeleteId(null);
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to delete complaint');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading Admin Analytics...</div>;

  const summary = stats?.summary || {};
  const departmentStats = stats?.departmentStats || [];
  const categoryDist = stats?.categoryDistribution || {};

  return (
    <div>
      <div className="responsive-header">
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 5vw, 1.8rem)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', lineHeight: 1.2 }}>
            <Shield size={24} color="#0f172a" style={{ flexShrink: 0 }} /> Executive Admin Dashboard
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>City-wide infrastructure triage, SLA analytics & department management</p>
        </div>
        <button onClick={loadAdminData} className="btn btn-secondary">
          <RefreshCw size={16} /> Refresh Metrics
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="clay-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Complaints</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0' }}>{summary.total || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>100% Tracked</div>
        </div>

        <div className="clay-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Pending Action</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b45309', margin: '0.3rem 0' }}>{summary.pending || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Requires Dispatch</div>
        </div>

        <div className="clay-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Resolved & Closed</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803d', margin: '0.3rem 0' }}>{summary.resolved || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>Resolution Success Rate</div>
        </div>

        <div className="clay-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Critical Escalations</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626', margin: '0.3rem 0' }}>{summary.critical || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Immediate Field Dispatch</div>
        </div>
      </div>

      {/* Department Breakdown */}
      <div className="grid-2-1" style={{ marginBottom: '2rem' }}>
        <div className="clay-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} /> Department Workload Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {departmentStats.map(dept => (
              <div key={dept.id} style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{dept.name} ({dept.code})</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Active Officers Assigned</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total</div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{dept.totalComplaints}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#b45309' }}>Pending</div>
                    <div style={{ fontWeight: 800, color: '#b45309' }}>{dept.pendingComplaints}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#15803d' }}>Resolved</div>
                    <div style={{ fontWeight: 800, color: '#15803d' }}>{dept.resolvedComplaints}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="clay-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} /> Category Mix
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {Object.entries(categoryDist).map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                <span style={{ textTransform: 'capitalize', color: '#334155', fontWeight: 600 }}>{cat.replace('_', ' ')}</span>
                <span className="badge" style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="clay-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem' }}>Recent Infrastructure Issues</h3>

        {/* Desktop Table View (>768px) */}
        <div className="desktop-only responsive-table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Issue Title</th>
                <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem' }}>Priority</th>
                <th style={{ padding: '0.85rem 1rem' }}>Department</th>
                <th style={{ padding: '0.85rem 1rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                    {item.title}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textTransform: 'capitalize', color: '#334155' }}>
                    {item.category.replace('_', ' ')}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontWeight: 600 }}>
                    {item.cf_departments?.name || 'Unassigned'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                      <Eye size={14} /> View
                    </Link>
                    <button
                      onClick={() => { setReassignModalItem(item); setSelectedDept(item.department_id || ''); }}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      <Edit size={14} /> Reassign
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}
                      title="Delete Complaint"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (<=768px) - No Horizontal Scrolling Required */}
        <div className="mobile-only">
          {complaints.map(item => (
            <div key={item.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{item.title}</div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge status={item.status} />
                <PriorityBadge priority={item.priority} />
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{item.cf_departments?.name || 'Unassigned'}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', marginTop: '0.25rem' }}>
                <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem', textDecoration: 'none', justifyContent: 'center' }}>
                  <Eye size={14} /> View
                </Link>
                <button
                  onClick={() => { setReassignModalItem(item); setSelectedDept(item.department_id || ''); }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem', justifyContent: 'center' }}
                >
                  <Edit size={14} /> Reassign
                </button>
                <button
                  onClick={() => setDeleteId(item.id)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2', justifyContent: 'center' }}
                  title="Delete Complaint"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {reassignModalItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="clay-card" style={{ padding: '2rem', maxWidth: '460px', width: '100%', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Reassign Complaint Department
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select a new municipal department to take ownership of "{reassignModalItem.title}".
            </p>

            <form onSubmit={handleReassignSubmit}>
              <div className="form-group">
                <label className="form-label">Select Target Department</label>
                <select
                  className="form-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  required
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setReassignModalItem(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={reassigning}>
                  {reassigning ? 'Reassigning...' : 'Save Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Modal */}
      {deleteId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem'
        }}>
          <div className="clay-card" style={{ padding: '2rem', maxWidth: '400px', width: '100%', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '12px' }}>
                <Trash2 size={24} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Admin Delete Complaint</h3>
                <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Remove complaint & all related audit history permanently.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDeleteComplaint} className="btn btn-primary" style={{ flex: 1, background: '#dc2626' }} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
