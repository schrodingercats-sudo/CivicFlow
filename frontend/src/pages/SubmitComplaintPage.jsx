import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintService } from '../services/complaint.service';
import { Send, MapPin, Upload, Navigation, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const SAMPLE_PHOTOS = [
  { label: 'Pothole Hazard', category: 'road_damage', url: '/images/complaints/road_damage.jpg' },
  { label: 'Drainage Overflow', category: 'drainage', url: '/images/complaints/drainage.jpg' },
  { label: 'Garbage Dumpster', category: 'garbage', url: '/images/complaints/garbage.jpg' },
  { label: 'Broken Street Light', category: 'street_lights', url: '/images/complaints/street_lights.jpg' },
  { label: 'Water Pipeline Leak', category: 'water_supply', url: '/images/complaints/water_supply.jpg' }
];

const compressImage = (file, callback) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 1400;
      const MAX_HEIGHT = 1400;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      callback(compressedDataUrl);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

export const SubmitComplaintPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'road_damage',
    priority: 'medium',
    latitude: '19.076090',
    longitude: '72.877426',
    address: 'Main MG Road, Crossing 4, Mumbai',
    image_url: SAMPLE_PHOTOS[0].url
  });

  const [previewImage, setPreviewImage] = useState(SAMPLE_PHOTOS[0].url);
  const [locating, setLocating] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAutoLocate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation GPS is not supported by your browser');
      return;
    }

    setLocating(true);
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          address: `GPS Location (${lat}, ${lng}), Local District`
        }));
        setLocating(false);
        setGpsSuccess(true);
      },
      (err) => {
        console.warn('GPS position acquisition failed:', err);
        setLocating(false);
        setError('Could not fetch GPS location. Please check browser location permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      compressImage(file, (compressedBase64) => {
        setPreviewImage(compressedBase64);
        setFormData(prev => ({ ...prev, image_url: compressedBase64 }));
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const complaint = await complaintService.createComplaint({
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude)
      });
      navigate(`/complaint/${complaint.id}`);
    } catch (err) {
      setError(err.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '1rem auto' }}>
      <div className="clay-card" style={{ padding: '2.5rem' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: '0.25rem' }}>
          Report Civic Complaint
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem' }}>
          Attach photo & auto-locate GPS position for AI-powered municipal triage.
        </p>

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Issue Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Road blockage due to gutter pipeline overflow"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Explain the damage, drainage/road blockage, safety hazards, and impact on traffic..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) => {
                  const cat = e.target.value;
                  const matchingSample = SAMPLE_PHOTOS.find(s => s.category === cat);
                  setFormData({
                    ...formData,
                    category: cat,
                    image_url: matchingSample ? matchingSample.url : formData.image_url
                  });
                  if (matchingSample) setPreviewImage(matchingSample.url);
                }}
              >
                <option value="road_damage">Road Damage</option>
                <option value="drainage">Drainage & Sewage</option>
                <option value="garbage">Garbage / Waste</option>
                <option value="street_lights">Street Lights</option>
                <option value="water_supply">Water Supply</option>
                <option value="electricity">Electricity</option>
                <option value="traffic">Traffic Operations</option>
                <option value="pollution">Pollution</option>
                <option value="public_property">Public Property</option>
                <option value="others">Others</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Perceived Priority</label>
              <select
                className="form-select"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical Emergency</option>
              </select>
            </div>
          </div>

          {/* GPS Auto Location Section */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <div className="responsive-header" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
                <MapPin size={18} color="#2563eb" /> Location & GPS Coordinates
              </div>

              <button
                type="button"
                onClick={handleAutoLocate}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderColor: gpsSuccess ? '#166534' : '#cbd5e1' }}
                disabled={locating}
              >
                {locating ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Locating...
                  </>
                ) : (
                  <>
                    <Navigation size={14} color="#0f172a" />
                    {gpsSuccess ? 'GPS Acquired ✓' : 'Auto-Detect My GPS'}
                  </>
                )}
              </button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Street Address / Landmark</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sector 4 Market Road Crossing"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Photo File Upload Section */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>
              <Upload size={18} color="#2563eb" /> Upload Complaint Photo
            </div>

            <div className="form-group">
              <label className="form-label">Select Photo from Device</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="form-input"
                style={{ padding: '0.5rem' }}
              />
            </div>

            {previewImage && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <img
                  src={previewImage}
                  alt="Complaint Preview"
                  style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={16} /> Photo Ready
                </span>
              </div>
            )}

            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', marginBottom: '0.35rem', fontWeight: 600 }}>Or select a category photo sample:</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {SAMPLE_PHOTOS.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPreviewImage(img.url);
                    setFormData(prev => ({ ...prev, image_url: img.url, category: img.category }));
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  {img.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={submitting}
          >
            {submitting ? 'Submitting Complaint...' : 'Submit Complaint'} <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
