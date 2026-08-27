import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, MapPin, Check, Clock, Camera, Navigation, AlertTriangle, Eye, Upload, X, Search, UserCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSearch } from '../context/SearchContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { AppLayout } from '../components/layout/AppLayout';
import { apiRequest } from '../services/api';

const compressImage = (file, callback) => {
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
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

export const WorkerDashboard = () => {
  const { user } = useAuth();
  const { searchQuery, refreshKey } = useSearch();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  
  // Modal state
  const [selectedTask, setSelectedTask] = useState(null);
  const [updateType, setUpdateType] = useState('accepted');
  const [remarks, setRemarks] = useState('');
  const [proofImage, setProofImage] = useState(null);
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [refreshKey]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/worker/tasks');
      setTasks(res.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesAddress = task.address?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAddress) return false;
      }
      if (filter === 'New') return ['submitted', 'under_review', 'assigned'].includes(task.status);
      if (filter === 'Active') return ['in_progress'].includes(task.status);
      if (filter === 'Completed') return ['resolved', 'closed'].includes(task.status);
      return true;
    });
  }, [tasks, searchQuery, filter]);

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    
    try {
      setUpdating(true);
      await apiRequest(`/worker/tasks/${selectedTask.id}/update`, {
        method: 'POST',
        body: JSON.stringify({
          update_type: updateType,
          remarks,
          proof_image_url: proofImage,
          latitude: location.latitude,
          longitude: location.longitude
        })
      });
      await fetchTasks();
      closeModal();
    } catch (error) {
      alert(error.message || 'Error updating task');
    } finally {
      setUpdating(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      compressImage(file, (compressedBase64) => {
        setProofImage(compressedBase64);
      });
    }
  };

  const captureLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => console.error("Error getting location", error)
      );
    }
  };

  const closeModal = () => {
    setSelectedTask(null);
    setUpdateType('accepted');
    setRemarks('');
    setProofImage(null);
    setLocation({ latitude: null, longitude: null });
  };

  const metrics = {
    assigned: tasks.filter(t => t.status === 'assigned').length,
    accepted: tasks.filter(t => ['submitted', 'under_review'].includes(t.status)).length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => ['resolved', 'closed'].includes(t.status)).length
  };

  return (
    <AppLayout
      headerTitle="Field Operations Tasks"
      headerSubtitle={`${user?.cf_departments?.name || 'Department'} Field Dispatch & Updates`}
    >
      {/* 4 KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="kpi-header">
            <span className="kpi-title">Assigned Tasks</span>
            <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="kpi-value">{metrics.assigned}</div>
          <div className="kpi-footer">Pending dispatch</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="kpi-header">
            <span className="kpi-title">Accepted / En Route</span>
            <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{metrics.accepted}</div>
          <div className="kpi-footer">En route to location</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">On Site / Active</span>
            <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Wrench size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{metrics.inProgress}</div>
          <div className="kpi-footer">Active repairs</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="kpi-header">
            <span className="kpi-title">Completed Work</span>
            <div className="kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <Check size={18} strokeWidth={2.8} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{metrics.completed}</div>
          <div className="kpi-footer">Resolved tasks</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
        {['All', 'New', 'Active', 'Completed'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '0.4rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid',
              cursor: 'pointer',
              background: filter === tab ? '#0f172a' : '#ffffff',
              color: filter === tab ? '#ffffff' : '#475569',
              borderColor: filter === tab ? '#0f172a' : '#e2e8f0',
              transition: 'all 0.15s ease'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading field tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="civic-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <Check size={36} color="#16a34a" strokeWidth={2.8} style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>All Tasks Clear</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            No tasks found under the "{filter}" filter.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredTasks.map(task => (
            <div key={task.id} className="civic-card" style={{ display: 'flex', padding: '1.25rem', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '110px', height: '90px', flexShrink: 0, borderRadius: '10px', overflow: 'hidden' }}>
                <ComplaintImage src={task.image_url} alt={task.title} category={task.category} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              
              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.35rem' }}>
                  <StatusBadge status={task.status} size="sm" />
                  <PriorityBadge priority={task.priority} size="sm" />
                </div>
                <h3 style={{ margin: '0 0 0.35rem 0', color: '#0f172a', fontSize: '1.05rem', fontWeight: 800 }}>{task.title}</h3>
                <p style={{ margin: '0 0 0.45rem 0', color: '#475569', fontSize: '0.85rem', lineHeight: 1.4 }}>{task.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#64748b', fontSize: '0.8rem' }}>
                  <MapPin size={13} color="#2563eb" />
                  <span>{task.address}</span>
                  <span>•</span>
                  <Clock size={13} />
                  <span>{new Date(task.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link to={`/complaint/${task.id}`} className="btn btn-secondary" style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem', textDecoration: 'none' }}>
                  <Eye size={15} /> View Details
                </Link>
                <button 
                  className="btn btn-primary"
                  onClick={() => setSelectedTask(task)}
                  style={{ padding: '0.55rem 0.95rem', fontSize: '0.82rem' }}
                >
                  <Navigation size={15} /> Update Progress
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Update Progress Modal */}
      {selectedTask && (
        <div style={{ 
          position: 'fixed', inset: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="civic-card" style={{ width: '100%', maxWidth: '480px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Update Task Progress</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '1.25rem' }}>Task: "{selectedTask.title}"</p>
            
            <form onSubmit={handleUpdateSubmit}>
              <div className="form-group">
                <label className="form-label">Worker Progress Stage</label>
                <select 
                  className="form-select"
                  value={updateType}
                  onChange={(e) => setUpdateType(e.target.value)}
                  required
                >
                  <option value="accepted">Task Accepted</option>
                  <option value="en_route">En Route to Site</option>
                  <option value="on_site">Arrived On Site</option>
                  <option value="in_progress">Work In Progress</option>
                  <option value="completed">Work Completed & Fixed</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Field Progress Remarks</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required
                  placeholder="Describe your current work status, materials needed, or completion details..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Capture / Upload Proof Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="form-input"
                  style={{ padding: '0.4rem', fontSize: '0.82rem' }}
                />
                {proofImage && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={proofImage} alt="Proof" style={{ width: '70px', height: '50px', objectFit: 'cover', borderRadius: '6px' }} />
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Check size={14} strokeWidth={2.8} /> Photo Attached
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">GPS Geotag Confirmation</label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={captureLocation}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <MapPin size={15} color="#2563eb" /> Auto-Capture My GPS
                </button>
                {location.latitude && location.longitude && (
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Check size={13} strokeWidth={2.8} /> Captured: ({location.latitude.toFixed(5)}, {location.longitude.toFixed(5)})
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={updating}>
                  {updating ? 'Saving...' : 'Submit Progress Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
