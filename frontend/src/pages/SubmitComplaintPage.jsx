import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintService } from '../services/complaint.service';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { GeoCamera } from '../components/common/GeoCamera';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Send,
  MapPin,
  Upload,
  Navigation,
  Check,
  AlertTriangle,
  RefreshCw,
  Camera,
  Image as ImageIcon,
  Flame,
  Layers,
  ArrowLeft,
  Construction,
  Pipette,
  Trash2,
  Lightbulb,
  Droplet,
  Zap,
  TrafficCone,
  Landmark,
  ClipboardList
} from 'lucide-react';

const CATEGORIES = [
  { value: 'road_damage', label: 'Road Damage', icon: Construction },
  { value: 'drainage', label: 'Drainage & Sewage', icon: Pipette },
  { value: 'garbage', label: 'Garbage & Waste', icon: Trash2 },
  { value: 'street_lights', label: 'Street Lights', icon: Lightbulb },
  { value: 'water_supply', label: 'Water Supply', icon: Droplet },
  { value: 'electricity', label: 'Electricity', icon: Zap },
  { value: 'traffic', label: 'Traffic Operations', icon: TrafficCone },
  { value: 'public_property', label: 'Public Property', icon: Landmark },
  { value: 'others', label: 'Other Civic Issue', icon: ClipboardList }
];

const compressImage = (file, callback) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 640;
      const MAX_HEIGHT = 640;

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

      // Highly optimized 65% quality JPEG (~35KB payload for instant upload)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
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
    latitude: '19.07609',
    longitude: '72.877426',
    address: 'Near Central Plaza, Main Road',
    image_url: null
  });

  const [geoImageUrl, setGeoImageUrl] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    handleAutoLocate();
  }, []);

  const reverseGeocode = async (lat, lng) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'CivicFlow-Complaint-App/1.0' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  };

  const buildAddressFromGeo = (geoData, lat, lng) => {
    if (!geoData || !geoData.address) return `GPS Location (${lat}, ${lng})`;
    const a = geoData.address;
    const parts = [];
    if (a.road) parts.push(a.road);
    if (a.suburb) parts.push(a.suburb);
    if (a.neighbourhood && !a.suburb) parts.push(a.neighbourhood);
    if (a.city) parts.push(a.city);
    if (a.town && !a.city) parts.push(a.town);
    if (a.village && !a.town && !a.city) parts.push(a.village);
    if (parts.length === 0) return geoData.display_name || `GPS Location (${lat}, ${lng})`;
    return parts.join(', ');
  };

  const handleAutoLocate = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation GPS is not supported by your browser');
      return;
    }

    setLocating(true);
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const geoData = await reverseGeocode(lat, lng);
        const realAddress = buildAddressFromGeo(geoData, lat, lng);
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          address: prev.address && prev.address.length > 0 && !prev.address.startsWith('GPS Location')
            ? prev.address
            : realAddress
        }));
        setLocating(false);
        setGpsSuccess(true);
      },
      (err) => {
        setLocating(false);
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
        setGeoImageUrl(null);
      });
    }
  };

  const handleRemovePhoto = () => {
    setPreviewImage(null);
    setFormData(prev => ({ ...prev, image_url: null }));
    setGeoImageUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await complaintService.createComplaint({
        ...formData,
        latitude: parseFloat(formData.latitude) || 19.07609,
        longitude: parseFloat(formData.longitude) || 72.877426,
        geo_image_url: geoImageUrl || null
      });
      navigate('/citizen');
    } catch (err) {
      setError(err.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const hasPhoto = !!previewImage;
  const hasGPS = !!formData.latitude && !!formData.longitude;

  return (
    <AppLayout
      headerTitle="Report an Issue"
      headerSubtitle="Submit your civic complaint with photo evidence & exact GPS location"
    >
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-secondary"
          style={{ marginBottom: '1.25rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="civic-card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
            New Civic Complaint Details
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.75rem' }}>
            Our AI will automatically categorize your report and dispatch it to the responsible municipal department.
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
              gap: '0.5rem',
              fontWeight: 600
            }}>
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Category Selector Tiles */}
            <div className="form-group">
              <label className="form-label">Select Issue Category</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.65rem', marginTop: '0.25rem' }}>
                {CATEGORIES.map(cat => {
                  const isSelected = formData.category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.value })}
                      style={{
                        padding: '0.75rem 0.65rem',
                        borderRadius: '10px',
                        border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        color: isSelected ? '#1d4ed8' : '#334155',
                        fontWeight: isSelected ? 800 : 600,
                        fontSize: '0.82rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center'
                      }}
                    >
                      <cat.icon size={22} color={isSelected ? '#2563eb' : '#64748b'} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label">Issue Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Deep pothole causing vehicle damage near College gate"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Detailed Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Describe the severity, location landmarks, and any immediate public safety hazard..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            {/* Priority */}
            <div className="form-group">
              <label className="form-label">Perceived Priority / Urgency</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { value: 'low', label: 'Low', color: '#64748b' },
                  { value: 'medium', label: 'Medium', color: '#d97706' },
                  { value: 'high', label: 'High', color: '#ea580c' },
                  { value: 'critical', label: 'Critical Emergency', color: '#dc2626' }
                ].map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p.value })}
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: `1.5px solid ${formData.priority === p.value ? p.color : '#e2e8f0'}`,
                      background: formData.priority === p.value ? '#ffffff' : '#f8fafc',
                      color: formData.priority === p.value ? p.color : '#64748b',
                      fontWeight: formData.priority === p.value ? 800 : 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location & GPS Section */}
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                  <MapPin size={18} color="#2563eb" /> GPS Location Coordinates
                </div>

                <button
                  type="button"
                  onClick={handleAutoLocate}
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', borderColor: gpsSuccess ? '#16a34a' : '#cbd5e1' }}
                  disabled={locating}
                >
                  {locating ? (
                    <>
                      <RefreshCw size={13} className="spin" /> Locating...
                    </>
                  ) : (
                    <>
                      {gpsSuccess ? <Check size={13} strokeWidth={2.8} color="#16a34a" /> : <Navigation size={13} color="#2563eb" />}
                      <span>{gpsSuccess ? 'GPS Acquired' : 'Auto-Detect My GPS'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Street Address / Landmark</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Near St. Xavier College Main Road"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              {hasGPS && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Incident Location Map Pin
                  </div>
                  <ComplaintMap
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    address={formData.address}
                    title={formData.title || 'Reported Location'}
                    height="200px"
                  />
                </div>
              )}
            </div>

            {/* Photo Evidence Section */}
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', marginBottom: '0.75rem' }}>
                <Camera size={18} color="#2563eb" /> Upload Site Photo
              </div>

              <div className="form-group">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="form-input"
                  style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                />
              </div>

              {hasPhoto && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                        Original Photo
                      </div>
                      <img
                        src={previewImage}
                        alt="Original"
                        style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>

                    {hasGPS && (
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={13} strokeWidth={2.8} /> GeoCam Verified
                        </div>
                        <GeoCamera
                          imageSrc={previewImage}
                          latitude={parseFloat(formData.latitude)}
                          longitude={parseFloat(formData.longitude)}
                          address={formData.address}
                          onGeoImageReady={(geoBase64) => setGeoImageUrl(geoBase64)}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="btn btn-secondary"
                    style={{ marginTop: '0.65rem', padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: '#dc2626' }}
                  >
                    Remove Photo
                  </button>
                </div>
              )}
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', borderRadius: '12px' }}
              disabled={submitting}
            >
              {submitting ? 'Submitting to Municipal Queue...' : 'Submit Civic Complaint'} <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};
