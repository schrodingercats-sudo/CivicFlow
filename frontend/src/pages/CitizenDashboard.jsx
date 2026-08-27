import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { complaintService } from '../services/complaint.service';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { PlusCircle, FileText, Clock, CheckCircle, MapPin, ChevronRight, AlertTriangle, XCircle, Trash2 } from 'lucide-react';

export const CitizenDashboard = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  
  const [withdrawId, setWithdrawId] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await complaintService.getComplaints(statusFilter ? { status: statusFilter } : {});
      setComplaints(res.complaints || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawId) return;
    setWithdrawing(true);
    try {
      await complaintService.withdrawComplaint(withdrawId, withdrawReason);
      setWithdrawId(null);
      setWithdrawReason('');
      await fetchComplaints();
    } catch (err) {
      alert(err.message || 'Failed to withdraw complaint');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await complaintService.deleteComplaint(deleteId);
      setDeleteId(null);
      await fetchComplaints();
    } catch (err) {
      alert(err.message || 'Failed to delete complaint');
    } finally {
      setDeleting(false);
    }
  };

  const totalCount = complaints.length;
  const inProgressCount = complaints.filter(c => ['in_progress', 'submitted', 'assigned', 'under_review'].includes(c.status)).length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;
  const withdrawnCount = complaints.filter(c => c.status === 'withdrawn').length;

  return (
    <div>
      <div className="responsive-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>Citizen Dashboard</h1>
        </div>
        <Link to="/submit" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          <PlusCircle size={18} /> New Complaint
        </Link>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="clay-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.9rem', background: '#0f172a', color: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 10px rgba(15,23,42,0.15)' }}>
            <FileText size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{totalCount}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Total Complaints</div>
          </div>
        </div>

        <div className="clay-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.9rem', background: '#dbeafe', color: '#1e40af', borderRadius: '12px' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e40af' }}>{inProgressCount}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Active / Pending</div>
          </div>
        </div>

        <div className="clay-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.9rem', background: '#dcfce7', color: '#166534', borderRadius: '12px' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#166534' }}>{resolvedCount}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Resolved</div>
          </div>
        </div>

        <div className="clay-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.9rem', background: '#fef3c7', color: '#92400e', borderRadius: '12px' }}>
            <XCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#92400e' }}>{withdrawnCount}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Withdrawn</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="responsive-tabs">
        {[
          { label: 'All Issues', value: '' },
          { label: 'Submitted', value: 'submitted' },
          { label: 'In Progress', value: 'in_progress' },
          { label: 'Resolved', value: 'resolved' },
          { label: 'Withdrawn', value: 'withdrawn' }
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`btn ${statusFilter === tab.value ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Complaints List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading complaints...</div>
      ) : complaints.length === 0 ? (
        <div className="clay-card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <AlertTriangle size={38} color="#64748b" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>No Complaints Found</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
            You haven't submitted any complaints under this filter tab yet.
          </p>
          <Link to="/submit" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            <PlusCircle size={16} /> Submit Your First Issue
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {complaints.map(item => (
            <div
              key={item.id}
              className="clay-card responsive-complaint-card"
            >
              <div className="responsive-card-content">
                <ComplaintImage
                  src={item.image_url}
                  alt={item.title}
                  title={item.title}
                  category={item.category}
                  style={{ width: '92px', height: '92px', flexShrink: 0 }}
                />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <StatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    {item.title}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#475569', flexWrap: 'wrap' }}>
                    <MapPin size={14} color="#2563eb" /> {item.address}
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{item.cf_departments?.name || 'Department Assigned'}</span>
                  </div>
                </div>
              </div>

              <div className="responsive-card-actions">
                {item.status !== 'resolved' && item.status !== 'closed' && item.status !== 'withdrawn' && item.status !== 'rejected' && (
                  <button
                    onClick={() => setWithdrawId(item.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: '#991b1b', borderColor: '#fecaca' }}
                    title="Withdraw Application"
                  >
                    <XCircle size={15} /> Withdraw
                  </button>
                )}
                {item.status === 'submitted' && (
                  <button
                    onClick={() => setDeleteId(item.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}
                    title="Delete Complaint"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                )}
                <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ padding: '0.65rem', textDecoration: 'none' }}>
                  <ChevronRight size={20} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Withdraw Modal */}
      {withdrawId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem'
        }}>
          <div className="clay-card" style={{ padding: '2rem', maxWidth: '440px', width: '100%', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Withdraw Complaint Application
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Are you sure you want to withdraw this issue? This action will close the complaint.
            </p>

            <form onSubmit={handleWithdraw}>
              <div className="form-group">
                <label className="form-label">Reason for Withdrawal (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Issue resolved independently or submitted by mistake"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setWithdrawId(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, background: '#991b1b' }} disabled={withdrawing}>
                  {withdrawing ? 'Withdrawing...' : 'Confirm Withdraw'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Delete Complaint</h3>
                <p style={{ color: '#64748b', fontSize: '0.82rem' }}>This action is permanent and cannot be undone.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDelete} className="btn btn-primary" style={{ flex: 1, background: '#dc2626' }} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
