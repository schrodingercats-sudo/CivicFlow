import React, { useState, useEffect, useRef } from 'react';
import { notificationService } from '../../services/notification.service';
import { useNtfy } from '../../hooks/useNtfy';
import { Bell, CheckCheck, ExternalLink, X, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [ntfyTopics, setNtfyTopics] = useState([]);
  const dropdownRef = useRef(null);

  // Fetch ntfy topics on mount
  useEffect(() => {
    const loadTopics = async () => {
      try {
        const res = await notificationService.getNtfyTopics();
        setNtfyTopics(res.topics || []);
      } catch (err) {
        // fallback: no real-time, polling still works
      }
    };
    loadTopics();
  }, []);

  // SSE real-time via ntfy
  const { messages: ntfyMessages, isConnected } = useNtfy(ntfyTopics);

  // When ntfy message arrives, refresh DB notifications
  useEffect(() => {
    if (ntfyMessages.length > 0) {
      fetchNotifications();
    }
  }, [ntfyMessages.length]);

  // Initial load + fallback polling (15s — ntfy handles real-time but this catches any gaps)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      await fetchNotifications();
    } catch (err) {
      // silent
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      await fetchNotifications();
    } catch (err) {
      // silent
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-secondary"
        style={{ padding: '0.45rem', borderRadius: '10px', position: 'relative' }}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 800,
            borderRadius: '9999px',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="clay-card notification-dropdown">
          {/* Header with close button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Notifications</span>
              {isConnected ? (
                <Wifi size={12} style={{ color: '#22c55e' }} title="Real-time connected" />
              ) : (
                <WifiOff size={12} style={{ color: '#ef4444' }} title="Polling mode" />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <CheckCheck size={13} /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', borderRadius: '6px' }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '1.5rem 0' }}>
              No notifications yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {notifications.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  style={{
                    background: n.is_read ? '#f8fafc' : '#f0f9ff',
                    border: `1px solid ${n.is_read ? '#f1f5f9' : '#bae6fd'}`,
                    padding: '0.7rem',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, color: n.is_read ? '#94a3b8' : '#0f172a', marginBottom: '0.1rem', fontSize: '0.8rem' }}>
                    {n.title}
                  </div>
                  <div style={{ color: '#475569', marginBottom: '0.3rem', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                    {n.link_url && (
                      <Link to={n.link_url} onClick={() => setOpen(false)} style={{ color: '#0f172a', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontWeight: 600 }}>
                        View <ExternalLink size={11} />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
