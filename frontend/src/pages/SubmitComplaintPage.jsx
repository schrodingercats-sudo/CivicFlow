import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintService } from '../services/complaint.service';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { GeoCamera } from '../components/common/GeoCamera';
import { Send, MapPin, Upload, Navigation, CheckCircle2, AlertCircle, RefreshCw, Camera, Image as ImageIcon } from 'lucide-react';

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
    latitude: '',
    longitude: '',
    address: '',
    image_url: null
  });

  const [geoImageUrl, setGeoImageUrl] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    handleAutoLocate();
  }, []);

  const reverseGeocode = async (lat, lng) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'CivicFlow-Complaint-App/1.0' }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch (e) {
      console.warn('Reverse geocoding failed:', e);
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
    if (a.county && !a.city && !a.town) parts.push(a.county);
    if (a.state) parts.push(a.state);
    if (a.postcode) parts.push(a.postcode);
    if (a.country) parts.push(a.country);
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
        console.warn('GPS position acquisition failed:', err);
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
      const result = await complaintService.createComplaint({
        ...formData,
        latitude: parseFloat(formData.latitude) || 0,
        longitude: parseFloat(formData.longitude) || 0,
        geo_image_url: geoImageUrl || null
      });
      const created = result?.complaint || result;
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
    <div style={{ maxWidth: '720px', width: '100%', margin: '1rem auto', overflow: 'hidden' }}>
      <div className="clay-card" style={{ padding: '2.5rem', maxWidth: '100%', overflow: 'hidden' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: '0.25rem' }}>
          Report Civic Complaint
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem' }}>
          Upload a real photo from the site & auto-locate GPS position. A GeoCam verified copy is generated automatically.
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
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
                  placeholder="Auto-detected"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  className="form-input"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="Auto-detected"
                  required
                />
              </div>
            </div>

            {hasGPS && (
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Live GPS Pin Preview
                </div>
                <ComplaintMap
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  address={formData.address}
                  title={formData.title || 'Selected Incident Location'}
                  height="260px"
                />
              </div>
            )}
          </div>

          {/* Photo Upload Section */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>
              <Camera size={18} color="#2563eb" /> Upload Site Photo <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.78rem' }}>(Optional)</span>
            </div>

            <div className="form-group">
              <label className="form-label">Select Photo from Device</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="form-input"
                style={{ padding: '0.5rem' }}
              />
            </div>

            {hasPhoto && (
              <div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ImageIcon size={13} /> Original Photo
                    </div>
                    <img
                      src={previewImage}
                      alt="Original"
                      style={{ width: '100%', maxWidth: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'block' }}
                    />
                  </div>

                  {hasGPS && (
                    <div style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle2 size={13} /> GeoCam Verified
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
                  style={{ marginTop: '0.75rem', padding: '0.3rem 0.75rem', fontSize: '0.78rem', color: '#ef4444' }}
                >
                  Remove Photo
                </button>
              </div>
            )}

            {!hasPhoto && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                <Upload size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <div>No photo uploaded. You can submit without a photo.</div>
              </div>
            )}
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
