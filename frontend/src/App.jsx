import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/common/Navbar';
import { RateLimitBlockPage } from './components/common/RateLimitBlockPage';
import { Agentation } from 'agentation';

// ── Global Enterprise Rate Limiter & Flood Shield (SOC-2 CC6.6) ──
const GlobalRateLimiter = ({ children }) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [incidentId, setIncidentId] = useState(null);

  useEffect(() => {
    // 1. Check existing persisted rate limit in localStorage
    const checkPersistedLock = () => {
      try {
        const lockUntil = parseInt(localStorage.getItem('civicflow_rate_limit_until') || '0', 10);
        const remainingSec = Math.ceil((lockUntil - Date.now()) / 1000);
        if (remainingSec > 0) {
          setCountdown(remainingSec);
          setIsBlocked(true);
          return true;
        } else {
          localStorage.removeItem('civicflow_rate_limit_until');
          return false;
        }
      } catch (_e) {
        return false;
      }
    };

    const alreadyBlocked = checkPersistedLock();

    // 2. Rapid Page Reload / Refresh Detection (e.g. 4+ refreshes within 6 seconds on ANY page)
    if (!alreadyBlocked) {
      try {
        const now = Date.now();
        const storedLoads = JSON.parse(sessionStorage.getItem('civicflow_page_loads') || '[]');
        // Keep loads within the last 6.5 seconds
        const recentLoads = [...storedLoads.filter(t => now - t < 6500), now];
        sessionStorage.setItem('civicflow_page_loads', JSON.stringify(recentLoads));

        if (recentLoads.length >= 4) {
          const cooldownSec = 25;
          localStorage.setItem('civicflow_rate_limit_until', (now + cooldownSec * 1000).toString());
          setCountdown(cooldownSec);
          setIncidentId(`REFRESH-BURST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
          setIsBlocked(true);
        }
      } catch (_e) {}
    }

    // 3. API 429 Event Interceptor (Any backend rate limit response)
    const handleApiRateLimit = (e) => {
      const detail = e.detail || {};
      const cooldownSec = detail.retryAfter || 30;
      const now = Date.now();
      localStorage.setItem('civicflow_rate_limit_until', (now + cooldownSec * 1000).toString());
      setCountdown(cooldownSec);
      setIncidentId(`API-429-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
      setIsBlocked(true);
    };

    window.addEventListener('civicflow-rate-limit', handleApiRateLimit);
    return () => window.removeEventListener('civicflow-rate-limit', handleApiRateLimit);
  }, []);

  const handleUnlock = () => {
    localStorage.removeItem('civicflow_rate_limit_until');
    sessionStorage.removeItem('civicflow_page_loads');
    setIsBlocked(false);
  };

  if (isBlocked) {
    return (
      <RateLimitBlockPage
        countdown={countdown}
        initialCooldown={countdown}
        onUnlock={handleUnlock}
        incidentId={incidentId}
      />
    );
  }

  return children;
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
      <GlobalRateLimiter>
        <BrowserRouter>
          <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
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
      </GlobalRateLimiter>
    </AuthProvider>
  );
}
