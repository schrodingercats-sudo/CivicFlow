import React, { useState, useEffect } from 'react';
import { complaintService } from '../services/complaint.service';
import { useAuth } from '../hooks/useAuth';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { Briefcase, CheckCircle2, MapPin, Eye, Edit3, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const PROOF_PHOTO_PRESETS = [
  { label: 'Road Repaired', url: '/images/complaints/road_damage.jpg' },
  { label: 'Garbage Cleared', url: '/images/complaints/garbage.jpg' },
  { label: 'Light Repaired', url: '/images/complaints/street_lights.jpg' }
];

export const OfficerDashboard = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState('in_progress');
  const [remarks, setRemarks] = useState('');
  const [proofUrl, setProofUrl] = useState(PROOF_PHOTO_PRESETS[0].url);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchDepartmentComplaints();
  }, [statusFilter]);

  const fetchDepartmentComplaints = async () => {
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

  const handleOpenUpdateModal = (complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status === 'submitted' ? 'in_progress' : 'resolved');
    setRemarks(complaint.ai_suggested_response || `Action initiated by ${user.name}`);
    setProofUrl(PROOF_PHOTO_PRESETS[0].url);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    setUpdating(true);
    try {
      await complaintService.updateStatus(selectedComplaint.id, {
        status: newStatus,
        remarks: remarks,
        proof_image_url: newStatus === 'resolved' ? proofUrl : null
      });

      setSelectedComplaint(null);
      await fetchDepartmentComplaints();
    } catch (err) {
      alert(err.message || 'Failed to update complaint status');
    } finally {
      setUpdating(false);
    }
  };

  const totalAssigned = complaints.length;
  const pendingAction = complaints.filter(c => c.status === 'submitted' || c.status === 'under_review').length;
  const inProgress = complaints.filter(c => c.status === 'in_progress').length;
  const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;

  return (
    <div>
      <div className="responsive-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase color="#0f172a" /> Officer Department Queue
          </h1>
          <p style={{ color: '#475569', fontSize: '0.875rem' }}>
            Assigned Department: <strong style={{ color: '#0f172a' }}>{user.cf_departments?.name || 'Roads & Infrastructure'}</strong>
          </p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="clay-card" style={{ padding: '1.35rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{totalAssigned}</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Total Assigned</div>
        </div>
        <div className="clay-card" style={{ padding: '1.35rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b45309' }}>{pendingAction}</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Action Needed</div>
        </div>
        <div className="clay-card" style={{ padding: '1.35rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d4ed8' }}>{inProgress}</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>In Progress</div>
        </div>
        <div className="clay-card" style={{ padding: '1.35rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803d' }}>{resolved}</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Resolved</div>
        </div>
      </div>

      <div className="responsive-tabs">
        {[
          { label: 'All Complaints', value: '' },
          { label: 'Action Needed', value: 'submitted' },
          { label: 'In Progress', value: 'in_progress' },
          { label: 'Resolved', value: 'resolved' }
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

      {/* Department Live Location GIS Map */}
      {!loading && complaints.length > 0 && (
        <div className="clay-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={18} color="#2563eb" /> Assigned Department Live GIS Map
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Live GPS pin locations of assigned infrastructure issues requiring field dispatch
          </p>
          <ComplaintMap
            markers={complaints}
            height="320px"
          />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading assigned complaints...</div>
      ) : complaints.length === 0 ? (
        <div className="clay-card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <CheckCircle2 size={38} color="#166534" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>Queue Clear</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            No complaints currently pending under this filter tab.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {complaints.map(item => (
            <div key={item.id} className="clay-card responsive-complaint-card">
              <div className="responsive-card-content">
                <ComplaintImage
                  src={item.image_url}
                  alt={item.title}
                  title={item.title}
                  category={item.category}
                  style={{ width: '100px', height: '100px', flexShrink: 0 }}
                />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <StatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Submitted: {new Date(item.created_at).toLocaleDateString()}</span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    {item.title}
                  </h3>

                  <p style={{ fontSize: '0.875rem', color: '#334155', marginBottom: '0.5rem' }}>
                    {item.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                    <MapPin size={14} color="#2563eb" /> {item.address}
                  </div>

                  {item.ai_suggested_response && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.8rem', color: '#334155', marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sparkles size={14} color="#2563eb" /> <strong>Suggested Action:</strong> {item.ai_suggested_response}
                    </div>
                  )}
                </div>
              </div>

              <div className="responsive-card-actions">
                <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ padding: '0.6rem 0.95rem', fontSize: '0.85rem', textDecoration: 'none' }}>
                  <Eye size={16} /> View
                </Link>
                <button
                  onClick={() => handleOpenUpdateModal(item)}
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 0.95rem', fontSize: '0.85rem' }}
                >
                  <Edit3 size={16} /> Update Status
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedComplaint && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem'
        }}>
          <div className="clay-card" style={{ padding: '2rem', maxWidth: '520px', width: '100%', background: '#ffffff' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Update Complaint Action
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Issue: "{selectedComplaint.title}"
            </p>

            <form onSubmit={handleUpdateStatus}>
              <div className="form-group">
                <label className="form-label">New Status</label>
                <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value="in_progress">In Progress (Work Dispatched)</option>
                  <option value="resolved">Resolved (Issue Fixed)</option>
                  <option value="rejected">Rejected (Invalid/Duplicate)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Official Remarks / Resolution Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Detail official inspection, repair actions, or team comments..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required
                />
              </div>

              {newStatus === 'resolved' && (
                <div style={{ background: '#f8fafc', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a' }}>
                    <ImageIcon size={16} /> Attach Resolution Proof Image URL
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>Sample proof presets:</div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                    {PROOF_PHOTO_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setProofUrl(p.url)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem' }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setSelectedComplaint(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={updating}>
                  {updating ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
