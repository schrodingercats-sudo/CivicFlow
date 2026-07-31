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
  height = '320px',
  zoom = 15,
  style = {}
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialLat = Number(latitude) || 19.07609;
    const initialLng = Number(longitude) || 72.877426;

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: zoom,
      scrollWheelZoom: false
    });

    mapInstanceRef.current = map;

    // OpenStreetMap Tile Layer (High contrast, crisp tiles)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | CivicFlow GPS'
    }).addTo(map);

    // Custom Marker Icon SVG
    const customIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `
        <div style="
          background: #0f172a;
          color: #ffffff;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.4);
          border: 3px solid #ffffff;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
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
            <div style="font-family: inherit; font-size: 0.85rem; padding: 4px;">
              <strong style="color: #0f172a; font-size: 0.95rem;">${m.title || 'Complaint Location'}</strong>
              <div style="color: #64748b; font-size: 0.75rem; margin: 4px 0;">${m.address || 'Reported Location'}</div>
              <a href="/complaint/${m.id}" style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; margin-top: 4px;">View Issue</a>
            </div>
          `);
        }
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    } else {
      // Single Location Pin
      const marker = L.marker([initialLat, initialLng], { icon: customIcon }).addTo(map);
      const googleMapsUrl = `https://www.google.com/maps?q=${initialLat},${initialLng}`;

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 0.85rem; padding: 4px; min-width: 180px;">
          <div style="font-weight: 800; color: #0f172a; font-size: 0.95rem; margin-bottom: 2px;">${title || 'Exact Incident Spot'}</div>
          <div style="color: #475569; font-size: 0.78rem; margin-bottom: 6px;">${address || 'Citizen Geo-tagged GPS'}</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 8px;">GPS: ${initialLat.toFixed(6)}, ${initialLng.toFixed(6)}</div>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; background: #2563eb; color: #ffffff; text-decoration: none; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
            Open in Google Maps ↗
          </a>
        </div>
      `).openPopup();
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
  }, [latitude, longitude, address, title, zoom, JSON.stringify(markers)]);

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: '14px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', ...style }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
    </div>
  );
};
