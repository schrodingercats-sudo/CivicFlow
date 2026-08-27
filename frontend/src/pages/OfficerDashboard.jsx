import React, { useState, useEffect, useMemo } from 'react';
import { complaintService } from '../services/complaint.service';
import { useAuth } from '../hooks/useAuth';
import { useSearch } from '../context/SearchContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Briefcase,
  Check,
  MapPin,
  Eye,
  Edit3,
  Image as ImageIcon,
  Sparkles,
  Upload,
  Wrench,
  UserPlus,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  X,
  UserCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PROOF_PHOTO_PRESETS = [
  { label: 'Road Repaired', url: '/images/complaints/road_damage.jpg' },
  { label: 'Garbage Cleared', url: '/images/complaints/garbage.jpg' },
  { label: 'Light Repaired', url: '/images/complaints/street_lights.jpg' }
];

const compressProofImage = (file, callback) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const MAX = 1200;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

export const OfficerDashboard = () => {
  const { user } = useAuth();
  const { searchQuery, refreshKey } = useSearch();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showMap, setShowMap] = useState(true);
  
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState('in_progress');
  const [remarks, setRemarks] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [updating, setUpdating] = useState(false);

  // Worker assignment
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchDepartmentComplaints();
  }, [statusFilter, refreshKey]);

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        const res = await complaintService.getWorkers();
        setWorkers(res.workers || []);
      } catch (err) { /* no workers */ }
    };
    loadWorkers();
  }, []);

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
    setRemarks(complaint.ai_suggested_response || `Action initiated by ${user?.name || 'Officer'}`);
    setProofUrl('');
    setProofPreview('');
    setSelectedWorkerId('');
  };

  const handleAssignWorker = async () => {
    if (!selectedComplaint || !selectedWorkerId) return;
    setAssigning(true);
    try {
      await complaintService.assignWorker(selectedComplaint.id, selectedWorkerId);
      setSelectedComplaint(null);
      await fetchDepartmentComplaints();
    } catch (err) {
      alert(err.message || 'Failed to assign worker');
    } finally {
      setAssigning(false);
    }
  };

  const handleProofFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      compressProofImage(file, (base64) => {
        setProofUrl(base64);
        setProofPreview(base64);
      });
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    setUpdating(true);
    try {
      await complaintService.updateStatus(selectedComplaint.id, {
        status: newStatus,
        remarks: remarks,
        proof_image_url: proofUrl || null
      });

      setSelectedComplaint(null);
      await fetchDepartmentComplaints();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  // Filtered complaints by search and priority
  const filteredComplaints = useMemo(() => {
    return complaints.filter(item => {
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesAddress = item.address?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAddress) return false;
      }
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [complaints, searchQuery, priorityFilter]);

  const totalAssigned = complaints.length;
  const pendingAction = complaints.filter(c => c.status === 'submitted' || c.status === 'under_review').length;
  const inProgress = complaints.filter(c => c.status === 'in_progress').length;
  const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;

  return (
    <AppLayout
      headerTitle="Officer Department Queue"
      headerSubtitle={`Assigned Department: ${user?.cf_departments?.name || 'Roads & Infrastructure'}`}
    >
      {/* 4 KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Assigned</span>
            <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Briefcase size={18} />
            </div>
          </div>
          <div className="kpi-value">{totalAssigned}</div>
          <div className="kpi-footer">Active caseload</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="kpi-header">
            <span className="kpi-title">Action Needed</span>
            <div className="kpi-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>{pendingAction}</div>
          <div className="kpi-footer">Requires triage/dispatch</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="kpi-header">
            <span className="kpi-title">In Progress</span>
            <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{inProgress}</div>
          <div className="kpi-footer">Field work active</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="kpi-header">
            <span className="kpi-title">Resolved</span>
            <div className="kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <Check size={18} strokeWidth={2.8} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{resolved}</div>
          <div className="kpi-footer">Verified fixes</div>
        </div>
      </div>

      {/* Filter Tabs & Map Toggle Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {[
            { label: 'All Complaints', value: '' },
            { label: 'Action Needed', value: 'submitted' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Resolved', value: 'resolved' }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.82rem',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              fontWeight: 600
            }}
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <button
            onClick={() => setShowMap(!showMap)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
          >
            <MapPin size={14} /> {showMap ? 'Hide Map' : 'Show Map'}
          </button>
        </div>
      </div>

      {/* Department Live Location GIS Map */}
      {showMap && complaints.length > 0 && (
        <div className="civic-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <MapPin size={18} color="#2563eb" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Department Active Incident Map
            </h2>
          </div>
          <ComplaintMap
            markers={filteredComplaints.length > 0 ? filteredComplaints : complaints}
            height="260px"
          />
        </div>
      )}

      {/* Complaints List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
          <div>Loading department queue...</div>
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="civic-card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <Check size={36} color="#16a34a" strokeWidth={2.8} style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>Queue Clear</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            No complaints currently pending under this filter.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredComplaints.map(item => (
            <div
              key={item.id}
              className="civic-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.25rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, minWidth: '280px' }}>
                <div style={{ width: '92px', height: '92px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                  <ComplaintImage
                    src={item.image_url}
                    alt={item.title}
                    category={item.category}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <StatusBadge status={item.status} size="sm" />
                    <PriorityBadge priority={item.priority} size="sm" />
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    {item.title}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: '#475569' }}>
                    <MapPin size={13} color="#2563eb" /> {item.address}
                  </div>

                  {item.ai_suggested_response && (
                    <div style={{ background: '#eff6ff', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', color: '#1e40af', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Sparkles size={13} /> <strong>AI Action:</strong> {item.ai_suggested_response}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem', textDecoration: 'none' }}>
                  <Eye size={15} /> View
                </Link>
                <button
                  onClick={() => handleOpenUpdateModal(item)}
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 0.95rem', fontSize: '0.82rem' }}
                >
                  <Edit3 size={15} /> Update Status
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Update Modal */}
      {selectedComplaint && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="civic-card" style={{ padding: '2rem', maxWidth: '520px', width: '100%', background: '#ffffff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Update Complaint Action
              </h2>
              <button onClick={() => setSelectedComplaint(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
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
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a' }}>
                    <ImageIcon size={15} /> Resolution Proof Image
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProofFileUpload}
                    className="form-input"
                    style={{ padding: '0.4rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}
                  />

                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 600 }}>Quick Presets:</div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {PROOF_PHOTO_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setProofUrl(p.url); setProofPreview(p.url); }}
                        className="btn btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {proofPreview && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <img
                        src={proofPreview}
                        alt="Proof"
                        style={{ width: '70px', height: '50px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Check size={14} strokeWidth={2.8} /> Attached
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Assign Field Worker */}
              {workers.length > 0 && (
                <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a' }}>
                    <Wrench size={15} /> Assign Field Worker
                  </label>
                  <select
                    className="form-select"
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                  >
                    <option value="">— Select Worker —</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.cf_departments?.name || 'General'})
                      </option>
                    ))}
                  </select>
                  {selectedWorkerId && (
                    <button
                      type="button"
                      onClick={handleAssignWorker}
                      className="btn btn-primary"
                      style={{ marginTop: '0.65rem', width: '100%', padding: '0.5rem', fontSize: '0.82rem' }}
                      disabled={assigning}
                    >
                      <UserPlus size={14} /> {assigning ? 'Dispatching...' : 'Dispatch Worker'}
                    </button>
                  )}
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
    </AppLayout>
  );
};
