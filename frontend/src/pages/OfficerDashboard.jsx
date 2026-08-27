import React, { useState, useEffect } from 'react';
import { complaintService } from '../services/complaint.service';
import { useAuth } from '../hooks/useAuth';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { Pagination } from '../components/common/Pagination';
import { Briefcase, CheckCircle2, MapPin, Eye, Edit3, Image as ImageIcon, Sparkles, Upload, Wrench, UserPlus } from 'lucide-react';
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
      const MAX = 640;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

export const OfficerDashboard = () => {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // SWR Persistent Cache (Instant 0ms Load)
  const cacheKey = `/complaints?${statusFilter ? `status=${statusFilter}&` : ''}page=${page}&limit=${pageSize}`;
  const initialCache = getCachedResponse(cacheKey);
  const cachedWorkers = getCachedResponse('/workers');

  const [complaints, setComplaints] = useState(() => initialCache?.complaints || []);
  const [totalItems, setTotalItems] = useState(() => initialCache?.total ?? (initialCache?.complaints?.length || 0));
  const [loading, setLoading] = useState(() => initialCache === null);
  const lastHashRef = useRef(JSON.stringify(initialCache));
  
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState('in_progress');
  const [remarks, setRemarks] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [updating, setUpdating] = useState(false);

  // Worker assignment
  const [workers, setWorkers] = useState(() => cachedWorkers?.workers || []);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchDepartmentComplaints();
  }, [statusFilter, page, pageSize]);

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        const res = await complaintService.getWorkers();
        const list = res.workers || [];
        setWorkers(list);
        setCachedResponse('/workers', { workers: list });
      } catch (err) { /* no workers available */ }
    };
    loadWorkers();
  }, []);

  const fetchDepartmentComplaints = async () => {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      setComplaints(cached.complaints || []);
      setTotalItems(cached.total ?? (cached.complaints?.length || 0));
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const res = await complaintService.getComplaints({
        ...(statusFilter ? { status: statusFilter } : {}),
        page,
        limit: pageSize
      });
      const newComplaints = res.complaints || [];
      const newTotal = res.total ?? newComplaints.length;
      const newHash = JSON.stringify({ complaints: newComplaints, total: newTotal });

      if (newHash !== lastHashRef.current) {
        lastHashRef.current = newHash;
        setComplaints(newComplaints);
        setTotalItems(newTotal);
      }
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

      {/* Pagination Controls */}
      <Pagination
        currentPage={page}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
      />

      {selectedComplaint && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem'
        }}>
          <div className="clay-card" style={{ padding: '2rem', maxWidth: '520px', width: '100%', background: '#ffffff', maxHeight: '90vh', overflowY: 'auto' }}>
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
                    <ImageIcon size={16} /> Resolution Proof Image <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.78rem' }}>(Optional)</span>
                  </label>

                  {/* File Upload */}
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Upload from device</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofFileUpload}
                      className="form-input"
                      style={{ padding: '0.4rem', fontSize: '0.82rem' }}
                    />
                  </div>

                  {/* URL Input */}
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Or paste image URL</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://example.com/proof-photo.jpg"
                      value={proofUrl.startsWith('data:') ? '' : proofUrl}
                      onChange={(e) => { setProofUrl(e.target.value); setProofPreview(e.target.value); }}
                    />
                  </div>

                  {/* Presets */}
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 600 }}>Quick presets:</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {PROOF_PHOTO_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setProofUrl(p.url); setProofPreview(p.url); }}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem' }}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setProofUrl(''); setProofPreview(''); }}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem', color: '#ef4444' }}
                    >
                      No Proof
                    </button>
                  </div>

                  {/* Preview */}
                  {proofPreview && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img
                        src={proofPreview}
                        alt="Proof preview"
                        style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 size={14} /> Proof attached
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Assign Field Worker */}
              {workers.length > 0 && (
                <div style={{ background: '#eff6ff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0f172a' }}>
                    <Wrench size={16} /> Assign Field Worker <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.78rem' }}>(Optional)</span>
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
                      style={{ marginTop: '0.75rem', width: '100%', padding: '0.55rem', fontSize: '0.85rem' }}
                      disabled={assigning}
                    >
                      <UserPlus size={15} /> {assigning ? 'Dispatching...' : 'Dispatch Worker to Site'}
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
    </div>
  );
};
