import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, MapPin, CheckCircle2, Clock, Camera, Navigation, AlertTriangle, Eye, Upload, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { apiRequest } from '../services/api';

const compressImage = (file, callback) => {
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
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

export const WorkerDashboard = () => {
  const { user } = useAuth();
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
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('GET', '/worker/tasks');
      setTasks(res.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'New') return ['submitted', 'assigned'].includes(task.status);
    if (filter === 'Active') return ['accepted', 'en_route', 'on_site', 'in_progress'].includes(task.status);
    if (filter === 'Completed') return ['resolved', 'closed'].includes(task.status);
    return true;
  });

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    
    try {
      setUpdating(true);
      await apiRequest('POST', `/worker/tasks/${selectedTask.id}/update`, {
        update_type: updateType,
        remarks,
        proof_image_url: proofImage,
        latitude: location.latitude,
        longitude: location.longitude
      });
      // Refresh tasks and close modal
      await fetchTasks();
      closeModal();
    } catch (error) {
      console.error('Error updating task', error);
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

  const getMetrics = () => {
    return {
      assigned: tasks.filter(t => t.status === 'assigned').length,
      accepted: tasks.filter(t => ['accepted', 'en_route'].includes(t.status)).length,
      inProgress: tasks.filter(t => ['on_site', 'in_progress'].includes(t.status)).length,
      completed: tasks.filter(t => ['resolved', 'closed'].includes(t.status)).length
    };
  };

  const metrics = getMetrics();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <Wrench size={32} color="#2563eb" />
        <div>
          <h1 style={{ color: '#0f172a', margin: 0, fontSize: '1.8rem' }}>Field Worker Dashboard</h1>
          <p style={{ color: '#64748b', margin: '0.2rem 0 0 0' }}>
            {user?.cf_departments?.name || 'Department'} Worker
          </p>
        </div>
      </header>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="clay-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>{metrics.assigned}</div>
          <div style={{ color: '#64748b' }}>Assigned Tasks</div>
        </div>
        <div className="clay-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#b45309' }}>{metrics.accepted}</div>
          <div style={{ color: '#64748b' }}>Accepted / En Route</div>
        </div>
        <div className="clay-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>{metrics.inProgress}</div>
          <div style={{ color: '#64748b' }}>On Site / In Progress</div>
        </div>
        <div className="clay-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#15803d' }}>{metrics.completed}</div>
          <div style={{ color: '#64748b' }}>Completed</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        {['All', 'New', 'Active', 'Completed'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '0.5rem 1rem',
              background: filter === tab ? '#2563eb' : 'transparent',
              color: filter === tab ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: filter === tab ? '600' : 'normal'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <p>Loading tasks...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredTasks.length === 0 && <p style={{ color: '#64748b' }}>No tasks found for this filter.</p>}
          
          {filteredTasks.map(task => (
            <div key={task.id} className="clay-card" style={{ display: 'flex', padding: '1.5rem', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '150px', height: '100px', flexShrink: 0, borderRadius: '0.5rem', overflow: 'hidden' }}>
                <ComplaintImage url={task.image_url} alt="Task Image" />
              </div>
              
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>{task.title}</h3>
                <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '0.9rem' }}>{task.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <MapPin size={14} />
                  <span>{task.address}</span>
                  <span style={{ margin: '0 0.5rem' }}>•</span>
                  <Clock size={14} />
                  <span>{new Date(task.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '150px' }}>
                <Link to={`/complaint/${task.id}`} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <Eye size={16} /> View
                </Link>
                <button 
                  className="btn btn-primary"
                  onClick={() => setSelectedTask(task)}
                  style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Navigation size={16} /> Update Progress
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Update Modal */}
      {selectedTask && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.5)', 
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 
        }}>
          <div className="clay-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={closeModal}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={24} color="#64748b" />
            </button>
            
            <h2 style={{ marginTop: 0, color: '#0f172a', marginBottom: '1.5rem' }}>Update Progress</h2>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>Task: {selectedTask.title}</p>
            
            <form onSubmit={handleUpdateSubmit}>
              <div className="form-group">
                <label className="form-label">Worker Status</label>
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
                  <option value="completed">Work Completed</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks (Required)</label>
                <textarea 
                  className="form-textarea" 
                  rows="3" 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required
                  placeholder="Describe your progress..."
                ></textarea>
              </div>

              <div className="form-group">
                <label className="form-label">Proof Photo (Optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Camera size={16} /> Capture/Upload
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImageUpload} />
                  </label>
                  {proofImage && <CheckCircle2 size={20} color="#15803d" />}
                </div>
                {proofImage && (
                  <img src={proofImage} alt="Proof preview" style={{ marginTop: '1rem', maxHeight: '150px', borderRadius: '0.5rem' }} />
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={captureLocation} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={16} /> Auto GPS Capture
                  </button>
                  {(location.latitude && location.longitude) && <CheckCircle2 size={20} color="#15803d" />}
                </div>
                {(location.latitude && location.longitude) && (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                    Lat: {location.latitude.toFixed(4)}, Lng: {location.longitude.toFixed(4)}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating ? 'Submitting...' : 'Submit Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
