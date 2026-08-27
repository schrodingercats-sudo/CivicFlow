import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

export const RateLimitBlockPage = ({ countdown, initialCooldown = 30, onUnlock, incidentId = null }) => {
  const [timeLeft, setTimeLeft] = useState(countdown || 30);
  const [rayId] = useState(incidentId || `RAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}-BLR`);

  useEffect(() => {
    setTimeLeft(countdown);
  }, [countdown]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const progressPercent = Math.max(0, Math.min(100, ((initialCooldown - timeLeft) / (initialCooldown || 30)) * 100));

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999999,
      background: 'radial-gradient(ellipse at 50% 20%, #1e1b4b 0%, #0f172a 55%, #020617 100%)',
      color: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflowY: 'auto'
    }}>
      <div style={{
        maxWidth: '680px',
        width: '100%',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1.5px solid rgba(245, 158, 11, 0.4)',
        borderRadius: '24px',
        padding: 'clamp(1.5rem, 5vw, 2.75rem)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(245, 158, 11, 0.15)',
        backdropFilter: 'blur(20px)',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Top SOC-2 Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '0.35rem 1rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
          <ShieldAlert size={14} /> SOC 2 CC6.6 & OWASP API4 Protected
        </div>

        {/* Big Glowing 429 Header */}
        <div style={{
          fontSize: 'clamp(3.5rem, 12vw, 6rem)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 60%, #dc2626 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          429
        </div>

        <h1 style={{
          fontSize: 'clamp(1.3rem, 4vw, 1.85rem)',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          marginBottom: '0.75rem',
          lineHeight: 1.2
        }}>
          Too Many Requests — Rate Limit Exceeded
        </h1>

        <p style={{
          fontSize: '0.95rem',
          color: '#94a3b8',
          lineHeight: 1.6,
          maxWidth: '540px',
          margin: '0 auto 1.75rem auto'
        }}>
          CivicFlow's automated security gateway has temporarily restricted access from this browser due to rapid page reloads or excessive API request frequency.
        </p>

        {/* Countdown & Progress Bar */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700 }}>
              <Clock size={16} /> Security Cooldown Timer
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: timeLeft === 0 ? '#4ade80' : '#fbbf24' }}>
              {timeLeft === 0 ? 'Access Restored' : `Unlocks in ${timeLeft}s`}
            </span>
          </div>

          {/* Progress Bar Container */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: timeLeft === 0 ? '#22c55e' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
              transition: 'width 1s linear',
              borderRadius: '999px'
            }} />
          </div>
        </div>

        {/* Incident Metadata Box */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '2rem',
          fontSize: '0.78rem',
          color: '#64748b',
          textAlign: 'left',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          fontFamily: 'monospace'
        }}>
          <div>
            <span style={{ color: '#94a3b8' }}>Security Incident:</span> <strong style={{ color: '#e2e8f0' }}>{rayId}</strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>HTTP Status:</span> <strong style={{ color: '#f59e0b' }}>429 Too Many Requests</strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Protection:</span> <strong style={{ color: '#38bdf8' }}>Sliding-Window Limiter</strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Standard:</span> <strong style={{ color: '#a855f7' }}>SOC-2 CC6.6 / RFC 6585</strong>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {timeLeft === 0 ? (
            <button
              onClick={onUnlock}
              style={{
                background: '#22c55e',
                color: '#ffffff',
                border: 'none',
                padding: '0.85rem 2rem',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              <CheckCircle2 size={18} /> Restore & Reload CivicFlow
            </button>
          ) : (
            <button
              disabled
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '0.85rem 2rem',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Lock size={16} /> Cooldown Active ({timeLeft}s)
            </button>
          )}

          {/* Hackathon Demo Force-Unlock Button */}
          <button
            onClick={onUnlock}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
            title="Reset cooldown for testing"
          >
            <RefreshCw size={14} /> Force Reset (Demo)
          </button>
        </div>
      </div>
    </div>
  );
};
