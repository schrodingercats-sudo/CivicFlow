import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/common/Navbar';
import { Agentation } from 'agentation';
import { ShieldAlert, X, AlertTriangle } from 'lucide-react';

// ── Rate Limit Notification Banner (SOC-2 CC6.6 Real-Time Warning) ──
const RateLimitBanner = () => {
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const handleRateLimit = (e) => {
      const detail = e.detail || {};
      setRateLimitInfo(detail);
      setCountdown(detail.retryAfter || 30);
    };

    window.addEventListener('civicflow-rate-limit', handleRateLimit);
    return () => window.removeEventListener('civicflow-rate-limit', handleRateLimit);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!rateLimitInfo || countdown <= 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '1.25rem',
      right: '1.25rem',
      maxWidth: '420px',
      background: '#fff',
      border: '2px solid #f59e0b',
      borderRadius: '14px',
      padding: '1.1rem 1.25rem',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      zIndex: 99999,
      animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
            <ShieldAlert size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#92400e', lineHeight: 1.2 }}>
              429 Too Many Requests
            </div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              SOC-2 CC6.6 Rate Limit Triggered
            </div>
          </div>
        </div>
        <button
          onClick={() => setRateLimitInfo(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
        >
          <X size={16} />
        </button>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 0.75rem 0', lineHeight: 1.45 }}>
        Server is actively throttling rapid refresh bursts to protect government infrastructure from request flooding and DDoS abuse.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fffbeb', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e' }}>Cooldown Active</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309' }}>
          Retry in {countdown}s
        </span>
      </div>
    </div>
  );
};

// Lazy-loaded pages for better initial load performance
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const CitizenDashboard = lazy(() => import('./pages/CitizenDashboard').then(m => ({ default: m.CitizenDashboard })));
const SubmitComplaintPage = lazy(() => import('./pages/SubmitComplaintPage').then(m => ({ default: m.SubmitComplaintPage })));
const ComplaintDetailPage = lazy(() => import('./pages/ComplaintDetailPage').then(m => ({ default: m.ComplaintDetailPage })));
const OfficerDashboard = lazy(() => import('./pages/OfficerDashboard').then(m => ({ default: m.OfficerDashboard })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const WorkerDashboard = lazy(() => import('./pages/WorkerDashboard').then(m => ({ default: m.WorkerDashboard })));
const WorkerManagementPage = lazy(() => import('./pages/WorkerManagementPage').then(m => ({ default: m.WorkerManagementPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
      Loading...
    </div>
  </div>
);

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'citizen') return <Navigate to="/citizen" replace />;
  if (user.role === 'officer') return <Navigate to="/officer" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'worker') return <Navigate to="/worker" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
          <RateLimitBanner />
          <Navbar />
          <main style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Citizen Routes */}
                <Route
                  path="/citizen"
                  element={
                    <ProtectedRoute allowedRoles={['citizen']}>
                      <CitizenDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/submit"
                  element={
                    <ProtectedRoute allowedRoles={['citizen']}>
                      <SubmitComplaintPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/complaint/:id"
                  element={
                    <ProtectedRoute>
                      <ComplaintDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* Officer Routes */}
                <Route
                  path="/officer"
                  element={
                    <ProtectedRoute allowedRoles={['officer', 'admin']}>
                      <OfficerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Worker Routes */}
                <Route
                  path="/worker"
                  element={
                    <ProtectedRoute allowedRoles={['worker']}>
                      <WorkerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                {/* Worker Management (Admin + Officer) */}
                <Route
                  path="/workers"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'officer']}>
                      <WorkerManagementPage />
                    </ProtectedRoute>
                  }
                />

                {/* 404 */}
                <Route path="*" element={
                  <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
                    <div style={{ fontSize: '4rem', fontWeight: 900, color: '#e2e8f0', marginBottom: '0.5rem' }}>404</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Page not found</div>
                    <div style={{ color: '#64748b', marginBottom: '1.5rem' }}>The page you're looking for doesn't exist.</div>
                    <a href="/" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>← Go home</a>
                  </div>
                } />
              </Routes>
            </Suspense>
          </main>
          <Agentation />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
