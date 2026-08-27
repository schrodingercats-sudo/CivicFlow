import React, { useState, useEffect } from 'react';

export const RateLimitBlockPage = () => {
  const [minutesLeft, setMinutesLeft] = useState(15);

  useEffect(() => {
    // Check remaining minutes if stored
    try {
      const lockUntil = parseInt(localStorage.getItem('civicflow_rate_limit_until') || '0', 10);
      if (lockUntil) {
        const remainingMs = lockUntil - Date.now();
        const mins = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
        setMinutesLeft(mins);
      }
    } catch (_e) {}
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999999,
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Exact reference graphic representation */}
        <div style={{ position: 'relative', marginBottom: '1.5rem', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img
            src="/429-illustration.png"
            alt="429 Too Many Requests"
            style={{
              maxWidth: '360px',
              width: '100%',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>

        <p style={{
          fontSize: '1rem',
          color: '#475569',
          lineHeight: 1.6,
          margin: '0 0 1rem 0',
          maxWidth: '440px'
        }}>
          You have sent too many requests in a given amount of time. You can access again after {minutesLeft} minutes.
        </p>

        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid #f1f5f9',
          fontSize: '0.78rem',
          color: '#94a3b8',
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>CivicFlow Security Gateway</span>
          <span>HTTP 429 (Too Many Requests)</span>
        </div>
      </div>
    </div>
  );
};
