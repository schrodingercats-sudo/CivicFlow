import React, { useEffect, useRef, useState } from 'react';

export const GeoCamera = ({ imageSrc, latitude, longitude, address, onGeoImageReady }) => {
  const canvasRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(null);

  useEffect(() => {
    if (!imageSrc || latitude == null || longitude == null) return;

    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const originalImg = new Image();
    originalImg.crossOrigin = "anonymous";
    originalImg.src = imageSrc;

    originalImg.onload = () => {
      if (!isMounted) return;
      
      const MAX_WIDTH = 1400;
      let width = originalImg.width;
      let height = originalImg.height;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw original image
      ctx.drawImage(originalImg, 0, 0, width, height);

      // Draw overlay bar at bottom
      const barHeight = height * 0.25;
      const barY = height - barHeight;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, barY, width, barHeight);

      // Top right crosshair
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width - 40, 20);
      ctx.lineTo(width - 20, 20);
      ctx.moveTo(width - 30, 10);
      ctx.lineTo(width - 30, 30);
      ctx.stroke();

      // Top right green dot
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(width - 30, 20, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Load mini-map
      const mapImg = new Image();
      mapImg.crossOrigin = "anonymous";
      mapImg.src = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=120x90&markers=${latitude},${longitude},red-pushpin`;

      const drawText = () => {
        // Text overlay on the right (relative to map, or just generally right side)
        const textX = 20 + 120 + 20; // 20 padding + 120 map width + 20 padding
        const textY = barY + 30;

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        
        // Address
        ctx.font = 'bold 16px sans-serif';
        const addressText = address || 'Unknown Location';
        ctx.fillText(addressText.substring(0, 100), textX, textY);

        // Coordinates
        ctx.font = '14px sans-serif';
        ctx.fillText(`Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`, textX, textY + 25);

        // Date & Time
        const now = new Date();
        const formattedDate = `${now.toLocaleDateString('en-US', {weekday: 'long'})}, ${now.getDate()} ${now.toLocaleDateString('en-US', {month: 'short'})} ${now.getFullYear()} ${now.toLocaleTimeString('en-US', {hour12: false})}`;
        ctx.fillText(formattedDate, textX, textY + 50);

        // Pin Code / District (simplified extraction)
        const match = addressText.match(/\b\d{5,6}\b/);
        const pincode = match ? `Pin: ${match[0]}` : 'Local District';
        ctx.fillText(pincode, textX, textY + 75);

        // Finish up
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setPreviewSrc(dataUrl);
        if (onGeoImageReady) {
          onGeoImageReady(dataUrl);
        }
      };

      mapImg.onload = () => {
        if (!isMounted) return;
        // Draw minimap
        const mapX = 20;
        const mapY = barY + (barHeight - 90) / 2 - 10;
        ctx.drawImage(mapImg, mapX, mapY, 120, 90);

        // CivicFlow Logo Text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CivicFlow', mapX + 60, mapY + 90 + 15);

        drawText();
      };

      mapImg.onerror = () => {
        if (!isMounted) return;
        // Proceed without map
        ctx.fillStyle = '#475569';
        const mapX = 20;
        const mapY = barY + (barHeight - 90) / 2 - 10;
        ctx.fillRect(mapX, mapY, 120, 90);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Map Unavailable', mapX + 60, mapY + 45);
        ctx.fillText('CivicFlow', mapX + 60, mapY + 90 + 15);
        
        drawText();
      };
    };

    return () => {
      isMounted = false;
    };
  }, [imageSrc, latitude, longitude, address, onGeoImageReady]);

  return (
    <div className="w-full flex flex-col gap-4">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {previewSrc && (
        <img 
          src={previewSrc} 
          alt="Geo-stamped preview" 
          className="w-full h-auto rounded-md shadow-sm border border-slate-200"
        />
      )}
    </div>
  );
};
