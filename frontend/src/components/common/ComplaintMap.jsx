import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Plus, Minus } from 'lucide-react';

// Fix default Leaflet icon paths in Vite/Webpack build
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

export const ComplaintMap = ({
  latitude = 19.07609,
  longitude = 72.877426,
  address = '',
  title = '',
  category = 'General',
  markers = null, // Optional array of complaints for multi-marker city map view
  showYouAreHere = false,
  userLocation = null,
  height = '380px',
  zoom = 14,
  style = {}
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const initialLat = Number(latitude) || 19.07609;
  const initialLng = Number(longitude) || 72.877426;

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      if (showYouAreHere && userLocation) {
        mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], zoom, { animate: true });
      } else {
        mapInstanceRef.current.setView([initialLat, initialLng], zoom, { animate: true });
      }
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Default center
    const centerLat = userLocation?.lat || initialLat;
    const centerLng = userLocation?.lng || initialLng;

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: zoom,
      zoomControl: false,
      scrollWheelZoom: true,
      dragging: true,
      tap: true
    });

    mapInstanceRef.current = map;

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | CivicFlow'
    }).addTo(map);

    // Pin generator helper based on status
    const getPinIcon = (status, priority) => {
      let color = '#2563eb';
      let border = '#1d4ed8';
      let symbol = '<circle cx="12" cy="10" r="3" fill="#ffffff"/>';

      if (status === 'resolved' || status === 'closed') {
        color = '#16a34a'; // green
        border = '#15803d';
        symbol = '<path d="M9 11l2 2 4-4" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      } else if (status === 'in_progress') {
        color = '#d97706'; // amber
        border = '#b45309';
        symbol = '<circle cx="12" cy="10" r="2.5" fill="#ffffff"/>';
      } else if (status === 'submitted' || priority === 'critical' || priority === 'high') {
        color = '#dc2626'; // red
        border = '#b91c1c';
        symbol = '<line x1="12" y1="7" x2="12" y2="11" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="14" r="1" fill="#ffffff"/>';
      }

      return L.divIcon({
        className: 'custom-colored-pin',
        html: `
          <div style="
            background: ${color};
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border: 2px solid #ffffff;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="transform: rotate(45deg);">
              ${symbol}
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });
    };

    // "You are here" marker
    if (showYouAreHere) {
      const youAreHereLat = userLocation?.lat || initialLat;
      const youAreHereLng = userLocation?.lng || initialLng;

      const youHereIcon = L.divIcon({
        className: 'you-are-here-marker-icon',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; pointer-events: auto;">
            <div style="
              background: #2563eb;
              color: #ffffff;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 0.72rem;
              font-weight: 800;
              box-shadow: 0 4px 12px rgba(37,99,235,0.4);
              white-space: nowrap;
              border: 2px solid #ffffff;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></span>
              You are here
            </div>
            <div style="
              width: 0; 
              height: 0; 
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 6px solid #2563eb;
              margin-top: -1px;
            "></div>
          </div>
        `,
        iconSize: [100, 36],
        iconAnchor: [50, 36],
        popupAnchor: [0, -36]
      });

      L.marker([youAreHereLat, youAreHereLng], { icon: youHereIcon, zIndexOffset: 1000 }).addTo(map);
    }

    if (markers && Array.isArray(markers) && markers.length > 0) {
      const bounds = L.latLngBounds();
      let hasValidCoords = false;

      markers.forEach(m => {
        const mLat = Number(m.latitude);
        const mLng = Number(m.longitude);
        if (!isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0) {
          hasValidCoords = true;
          const pin = getPinIcon(m.status, m.priority);
          const marker = L.marker([mLat, mLng], { icon: pin }).addTo(map);
          bounds.extend([mLat, mLng]);
          
          const statusText = m.status ? m.status.replace('_', ' ').toUpperCase() : 'OPEN';
          const statusBg = m.status === 'resolved' ? '#dcfce7' : m.status === 'in_progress' ? '#fef3c7' : '#fee2e2';
          const statusColor = m.status === 'resolved' ? '#15803d' : m.status === 'in_progress' ? '#92400e' : '#b91c1c';

          marker.bindPopup(`
            <div style="font-family: inherit; width: 220px; box-sizing: border-box; padding: 2px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="background: ${statusBg}; color: ${statusColor}; font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 999px;">
                  ${statusText}
                </span>
                <span style="font-size: 0.7rem; color: #64748b; font-weight: 600;">
                  ${m.priority ? m.priority.toUpperCase() : ''}
                </span>
              </div>
              <strong style="color: #0f172a; font-size: 0.88rem; display: block; margin-bottom: 4px; line-height: 1.35; white-space: normal;">
                ${m.title || 'Civic Issue Location'}
              </strong>
              <div style="color: #64748b; font-size: 0.76rem; margin-bottom: 10px; line-height: 1.35; white-space: normal;">
                ${m.address || 'Reported Location'}
              </div>
              <a href="/complaint/${m.id}" style="display: block; width: 100%; text-align: center; background: #2563eb; color: #ffffff; text-decoration: none; padding: 6px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; box-sizing: border-box;">
                View Details ↗
              </a>
            </div>
          `, {
            minWidth: 220,
            maxWidth: 250,
            autoPan: true,
            autoPanPadding: [30, 30]
          });
        }
      });

      if (showYouAreHere && userLocation) {
        bounds.extend([userLocation.lat, userLocation.lng]);
      }

      if (hasValidCoords && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    } else if (!showYouAreHere || !userLocation) {
      // Single Location Pin
      const pin = getPinIcon('submitted', 'medium');
      const marker = L.marker([initialLat, initialLng], { icon: pin }).addTo(map);
      const googleMapsUrl = `https://www.google.com/maps?q=${initialLat},${initialLng}`;

      marker.bindPopup(`
        <div style="font-family: inherit; width: 220px; box-sizing: border-box; padding: 2px;">
          <div style="font-weight: 800; color: #0f172a; font-size: 0.88rem; line-height: 1.35; margin-bottom: 6px; white-space: normal;">
            ${title || 'Exact Incident Spot'}
          </div>
          <div style="color: #475569; font-size: 0.76rem; line-height: 1.35; margin-bottom: 6px; white-space: normal;">
            ${address || 'Citizen Geo-tagged GPS'}
          </div>
          <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 10px;">
            GPS: ${initialLat.toFixed(5)}, ${initialLng.toFixed(5)}
          </div>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; text-align: center; background: #2563eb; color: #ffffff; text-decoration: none; padding: 6px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; box-sizing: border-box;">
            Google Maps ↗
          </a>
        </div>
      `, {
        minWidth: 220,
        maxWidth: 250,
        autoPan: true,
        autoPanPadding: [30, 30]
      }).openPopup();
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, address, title, zoom, showYouAreHere, JSON.stringify(markers), JSON.stringify(userLocation)]);

  const googleMapsUrl = `https://www.google.com/maps?q=${initialLat},${initialLng}`;

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: '14px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', ...style }}>
      {/* Floating Modern Map Controls matching Image 1 & 2 */}
      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 400, display: 'flex', gap: '0.4rem' }}>
        <button
          onClick={handleZoomIn}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            fontSize: '1rem',
            fontWeight: 800,
            color: '#0f172a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
          }}
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            fontSize: '1.1rem',
            fontWeight: 800,
            color: '#0f172a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
          }}
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleRecenter}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '0 0.65rem',
            height: '32px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#0f172a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
          }}
          title="Recenter"
        >
          <Crosshair size={13} color="#2563eb" />
          <span>Recenter</span>
        </button>
      </div>

      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
    </div>
  );
};
