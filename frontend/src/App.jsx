import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/common/Navbar';

// Lazy-loaded pages for better initial load performance
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const CitizenDashboard = lazy(() => import('./pages/CitizenDashboard').then(m => ({ default: m.CitizenDashboard })));
const SubmitComplaintPage = lazy(() => import('./pages/SubmitComplaintPage').then(m => ({ default: m.SubmitComplaintPage })));
const ComplaintDetailPage = lazy(() => import('./pages/ComplaintDetailPage').then(m => ({ default: m.ComplaintDetailPage })));
const OfficerDashboard = lazy(() => import('./pages/OfficerDashboard').then(m => ({ default: m.OfficerDashboard })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const WorkerDashboard = lazy(() => import('./pages/WorkerDashboard').then(m => ({ default: m.WorkerDashboard })));
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
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
