import React, { useState, useEffect } from 'react';

// Local optimized images that match categories (used ONLY when user didn't upload a photo)
const CATEGORY_MAP = {
  water_supply: '/images/complaints/water_supply.jpg',
  drainage: '/images/complaints/drainage.jpg',
  road_damage: '/images/complaints/road_damage.jpg',
  garbage: '/images/complaints/garbage.jpg',
  street_lights: '/images/complaints/street_lights.jpg',
  electricity: '/images/complaints/electricity.jpg',
  traffic: '/images/complaints/traffic.jpg',
  pollution: '/images/complaints/pollution.jpg',
  public_property: '/images/complaints/public_property.jpg',
  others: '/images/complaints/public_property.jpg'
};

const TITLE_KEYWORDS = [
  { keywords: ['water', 'leak', 'pipe', 'burst', 'flooding', 'tap'], image: '/images/complaints/water_supply.jpg' },
  { keywords: ['gas', 'gas leak', 'lpg', 'cylinder'], image: '/images/complaints/gas_leak.jpg' },
  { keywords: ['gutter', 'drain', 'sewage', 'sewer', 'overflow', 'clog'], image: '/images/complaints/drainage.jpg' },
  { keywords: ['pothole', 'road damage', 'crack', 'asphalt'], image: '/images/complaints/road_damage.jpg' },
  { keywords: ['road block', 'blockage', 'barrier', 'blocked road'], image: '/images/complaints/road_blockage.jpg' },
  { keywords: ['garbage', 'waste', 'trash', 'dump', 'litter', 'rubbish'], image: '/images/complaints/garbage.jpg' },
  { keywords: ['street light', 'lamp', 'dark street'], image: '/images/complaints/street_lights.jpg' },
  { keywords: ['wire', 'electric', 'spark', 'power', 'voltage', 'cable'], image: '/images/complaints/electricity.jpg' },
  { keywords: ['traffic', 'signal', 'congestion', 'jam'], image: '/images/complaints/traffic.jpg' },
  { keywords: ['smoke', 'pollution', 'emission', 'smog', 'dust'], image: '/images/complaints/pollution.jpg' },
  { keywords: ['vandal', 'graffiti', 'property', 'bench', 'park', 'public'], image: '/images/complaints/public_property.jpg' },
];

const getMatchedImage = (src, title = '', category = 'others') => {
  // 1. IF USER UPLOADED / PROVIDED AN IMAGE (Base64 data URL, blob, http URL, or local path) - ALWAYS USE USER'S IMAGE!
  if (src && typeof src === 'string' && src.trim().length > 0) {
    return src.trim();
  }

  // 2. Otherwise fall back to title keyword matching
  const lowerTitle = (title || '').toLowerCase();
  for (const entry of TITLE_KEYWORDS) {
    for (const keyword of entry.keywords) {
      if (lowerTitle.includes(keyword)) {
        return entry.image;
      }
    }
  }

  // 3. Fall back to category map
  return CATEGORY_MAP[category] || CATEGORY_MAP.others;
};

export const ComplaintImage = ({ src, alt, title = '', category = 'others', style, className }) => {
  const [imgSrc, setImgSrc] = useState(() => getMatchedImage(src, title || alt, category));
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const nextSrc = getMatchedImage(src, title || alt, category);
    if (nextSrc !== imgSrc) {
      setImgSrc(nextSrc);
      setIsLoaded(false);
    }
  }, [src, title, alt, category]);

  const handleError = () => {
    const lowerTitle = (title || alt || '').toLowerCase();
    let fallback = CATEGORY_MAP[category] || CATEGORY_MAP.others;
    for (const entry of TITLE_KEYWORDS) {
      for (const keyword of entry.keywords) {
        if (lowerTitle.includes(keyword)) {
          fallback = entry.image;
          break;
        }
      }
    }
    if (imgSrc !== fallback) {
      setImgSrc(fallback);
    }
  };

  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '10px',
      background: '#f1f5f9',
      display: 'inline-block',
      width: style?.width || '100%',
      height: style?.height || '100%',
      ...style
    }}>
      {/* Skeleton Shimmer Loading Placeholder */}
      {!isLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          zIndex: 1
        }} />
      )}
      <img
        src={imgSrc}
        alt={alt || title || 'Complaint Photo'}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.25s ease-in-out',
          display: 'block'
        }}
        className={className}
      />
    </div>
  );
};
