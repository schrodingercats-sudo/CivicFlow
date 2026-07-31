import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  height = '380px',
  zoom = 15,
  style = {}
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const initialLat = Number(latitude) || 19.07609;
  const initialLng = Number(longitude) || 72.877426;

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([initialLat, initialLng], zoom, { animate: true });
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet map with zoom, drag, and auto-pan enabled
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: zoom,
      scrollWheelZoom: true,
      dragging: true,
      tap: true
    });

    mapInstanceRef.current = map;

    // OpenStreetMap High-Contrast Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | CivicFlow'
    }).addTo(map);

    // Custom Blue Pin Marker
    const customIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `
        <div style="
          background: #0f172a;
          color: #ffffff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.4);
          border: 3px solid #ffffff;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });

    if (markers && Array.isArray(markers) && markers.length > 0) {
      const bounds = L.latLngBounds();
      markers.forEach(m => {
        const mLat = Number(m.latitude);
        const mLng = Number(m.longitude);
        if (!isNaN(mLat) && !isNaN(mLng)) {
          const marker = L.marker([mLat, mLng], { icon: customIcon }).addTo(map);
          bounds.extend([mLat, mLng]);
          marker.bindPopup(`
            <div style="font-family: inherit; font-size: 0.85rem; padding: 2px; max-width: 240px; word-break: break-word;">
              <strong style="color: #0f172a; font-size: 0.9rem; display: block; margin-bottom: 4px; line-height: 1.3;">${m.title || 'Complaint Location'}</strong>
              <div style="color: #64748b; font-size: 0.75rem; margin-bottom: 6px; line-height: 1.3;">${m.address || 'Reported Location'}</div>
              <a href="/complaint/${m.id}" style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">View Issue Details ↗</a>
            </div>
          `, {
            autoPan: true,
            autoPanPadding: [35, 35],
            maxWidth: 270
          });
        }
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [45, 45] });
      }
    } else {
      // Single Location Pin
      const marker = L.marker([initialLat, initialLng], { icon: customIcon }).addTo(map);
      const googleMapsUrl = `https://www.google.com/maps?q=${initialLat},${initialLng}`;

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 0.85rem; padding: 2px; max-width: 240px; word-break: break-word;">
          <div style="font-weight: 800; color: #0f172a; font-size: 0.9rem; line-height: 1.35; margin-bottom: 4px;">${title || 'Exact Incident Spot'}</div>
          <div style="color: #475569; font-size: 0.78rem; line-height: 1.3; margin-bottom: 6px;">${address || 'Citizen Geo-tagged GPS'}</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 8px;">GPS: ${initialLat.toFixed(6)}, ${initialLng.toFixed(6)}</div>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; background: #2563eb; color: #ffffff; text-decoration: none; padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
            Open in Google Maps ↗
          </a>
        </div>
      `, {
        autoPan: true,
        autoPanPadding: [35, 35],
        maxWidth: 270
      }).openPopup();
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, address, title, zoom, JSON.stringify(markers)]);

  const googleMapsUrl = `https://www.google.com/maps?q=${initialLat},${initialLng}`;

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: '14px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', ...style }}>
      {/* Floating Action Controls */}
      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, display: 'flex', gap: '0.4rem' }}>
        <button
          onClick={handleRecenter}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#0f172a',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
          }}
          title="Recenter Map Pin"
        >
          🎯 Recenter
        </button>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#0f172a',
            border: 'none',
            borderRadius: '8px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#ffffff',
            textDecoration: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        >
          Google Maps ↗
        </a>
      </div>

      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
    </div>
  );
};
