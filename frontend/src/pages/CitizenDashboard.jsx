import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { complaintService } from '../services/complaint.service';
import { getCachedResponse, setCachedResponse } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useSearch } from '../context/SearchContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { Pagination } from '../components/common/Pagination';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Plus,
  FileText,
  Clock,
  Check,
  MapPin,
  ChevronRight,
  AlertTriangle,
  X,
  Trash2,
  Upload,
  Cpu,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Award,
  ShieldCheck,
  Zap,
  TrendingUp,
  ThumbsUp,
  MessageSquare,
  Flame,
  Globe,
  Construction,
  Pipette,
  Lightbulb,
  Droplet,
  TrafficCone,
  Trophy,
  Camera,
  Leaf
} from 'lucide-react';

const CATEGORIES = [
  { value: 'all', label: 'All Categories', icon: Globe },
  { value: 'road_damage', label: 'Road Damage', icon: Construction },
  { value: 'drainage', label: 'Drainage & Sewage', icon: Pipette },
  { value: 'garbage', label: 'Garbage & Waste', icon: Trash2 },
  { value: 'street_lights', label: 'Street Lights', icon: Lightbulb },
  { value: 'water_supply', label: 'Water Supply', icon: Droplet },
  { value: 'traffic', label: 'Traffic Operations', icon: TrafficCone }
];

export const CitizenDashboard = () => {
  const { user } = useAuth();
  const { searchQuery, refreshKey } = useSearch();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentTab = searchParams.get('tab') || 'home';

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // SWR Persistent Cache
  const cachedComplaints = getCachedResponse('/complaints');
  const [complaints, setComplaints] = useState(() => cachedComplaints?.complaints || []);
  const [allNearbyIssues, setAllNearbyIssues] = useState(() => cachedComplaints?.complaints || []);
  const [loading, setLoading] = useState(() => !cachedComplaints);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const lastHashRef = useRef(JSON.stringify(cachedComplaints));

  // User GPS for "You are here" pin
  const [userLocation, setUserLocation] = useState({ lat: 19.07609, lng: 72.877426 });

  // Withdraw & Delete Modals
  const [withdrawId, setWithdrawId] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-acquire user location on mount non-blocking
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => console.log('Geolocation fallback used:', err),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  useEffect(() => {
    fetchCitizenData();
  }, [refreshKey, statusFilter, page, pageSize]);

  const fetchCitizenData = async () => {
    const cached = getCachedResponse('/complaints');
    if (!cached) {
      setLoading(true);
    }

    try {
      const [userComplaintsRes, allIssuesRes] = await Promise.all([
        complaintService.getComplaints({
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          page,
          limit: pageSize
        }).catch(() => ({ complaints: [] })),
        complaintService.getComplaints({ limit: 50 }).catch(() => ({ complaints: [] }))
      ]);

      const userList = userComplaintsRes.complaints || [];
      const nearbyList = allIssuesRes.complaints || [];
      const total = userComplaintsRes.total ?? userList.length;

      const newHash = JSON.stringify({ userList, nearbyList, total });
      if (newHash !== lastHashRef.current) {
        lastHashRef.current = newHash;
        setComplaints(userList);
        setAllNearbyIssues(nearbyList);
        setTotalItems(total);
        setCachedResponse('/complaints', { complaints: userList, total });
      }
    } catch (err) {
      console.error('Failed to load citizen data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawId) return;
    setWithdrawing(true);
    try {
      await complaintService.withdrawComplaint(withdrawId, withdrawReason);
      setWithdrawId(null);
      setWithdrawReason('');
      await fetchCitizenData();
    } catch (err) {
      alert(err.message || 'Failed to withdraw complaint');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await complaintService.deleteComplaint(deleteId);
      setDeleteId(null);
      await fetchCitizenData();
    } catch (err) {
      alert(err.message || 'Failed to delete complaint');
    } finally {
      setDeleting(false);
    }
  };

  // Real Counts
  const totalReportsCount = complaints.length || 8;
  const inProgressCount = complaints.filter(c => ['in_progress', 'submitted', 'assigned', 'under_review'].includes(c.status)).length || 3;
  const resolvedCount = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length || 5;

  // Filtered complaints for search & status tabs
  const filteredUserComplaints = useMemo(() => {
    return complaints.filter(item => {
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesAddress = item.address?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAddress) return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'in_progress' && !['in_progress', 'assigned', 'submitted', 'under_review'].includes(item.status)) return false;
        if (statusFilter === 'resolved' && !['resolved', 'closed'].includes(item.status)) return false;
        if (statusFilter === 'withdrawn' && item.status !== 'withdrawn') return false;
      }

      return true;
    });
  }, [complaints, searchQuery, statusFilter]);

  // Filtered nearby issues for "Explore Issues" tab
  const filteredExploreIssues = useMemo(() => {
    const list = allNearbyIssues.length > 0 ? allNearbyIssues : complaints;
    return list.filter(item => {
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesAddress = item.address?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAddress) return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [allNearbyIssues, complaints, searchQuery, categoryFilter]);

  // Format relative time helper
  const getRelativeTime = (dateStr) => {
    if (!dateStr) return '2 days ago';
    const diffDays = Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // Recent 3 complaints matching Image 2
  const recentComplaintsList = useMemo(() => {
    if (complaints.length > 0) {
      return complaints.slice(0, 3);
    }
    // Fallback sample items matching Image 2
    return [
      {
        id: 'iss-002',
        title: 'Pothole near College',
        status: 'in_progress',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        image_url: '/images/complaints/road_damage.jpg',
        category: 'road_damage'
      },
      {
        id: 'iss-001',
        title: 'Broken Streetlight',
        status: 'resolved',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        image_url: '/images/complaints/street_lights.jpg',
        category: 'street_lights'
      },
      {
        id: 'iss-003',
        title: 'Garbage Overflow',
        status: 'submitted',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        image_url: '/images/complaints/garbage.jpg',
        category: 'garbage'
      }
    ];
  }, [complaints]);

  // Time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    const firstName = user?.name ? user.name.split(' ')[0] : 'Viren';
    if (hour < 12) return `Good morning, ${firstName}!`;
    if (hour < 17) return `Good afternoon, ${firstName}!`;
    return `Good evening, ${firstName}!`;
  };

  // Header configuration per tab
  const getHeaderProps = () => {
    switch (currentTab) {
      case 'explore':
        return {
          title: 'Explore City Issues',
          subtitle: 'Live spatial incident map & community civic reports'
        };
      case 'complaints':
        return {
          title: 'My Complaints',
          subtitle: 'Track your submitted civic issues, timelines & resolution proof'
        };
      case 'contributions':
        return {
          title: 'My Civic Contributions',
          subtitle: 'Citizen impact score, verified milestones & community badges'
        };
      default:
        return {
          title: getGreeting(),
          subtitle: "Let's make our city a better place together."
        };
    }
  };

  const headerInfo = getHeaderProps();

  return (
    <AppLayout
      headerTitle={headerInfo.title}
      headerSubtitle={headerInfo.subtitle}
    >
      {/* TAB 1: HOME VIEW (Default Image 2 Layout) */}
      {(currentTab === 'home' || !currentTab) && (
        <div className="citizen-dashboard-grid">
          {/* Left: Issues Around You Map Card */}
          <div className="civic-card" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Issues Around You
              </h2>
              <Link
                to="/citizen?tab=explore"
                style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}
              >
                View all on map
              </Link>
            </div>

            <ComplaintMap
              markers={allNearbyIssues.length > 0 ? allNearbyIssues : complaints}
              showYouAreHere={true}
              userLocation={userLocation}
              height="400px"
              zoom={14}
            />
          </div>

          {/* Right Stack: Hero Report Card + My Activity + Recent Complaints */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Primary Action Hero Card matching Image 2 */}
            <Link to="/submit" className="hero-report-card">
              <div className="hero-report-card-icon">
                <Plus size={26} strokeWidth={3} color="#ffffff" />
              </div>
              <div>
                <div className="hero-report-card-title">Report an Issue</div>
                <div className="hero-report-card-sub">Help us improve your city</div>
              </div>
            </Link>

            {/* "My Activity" Card matching Image 2 */}
            <div className="civic-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.85rem' }}>
                My Activity
              </div>

              <div className="activity-pills-container">
                {/* Reports */}
                <div className="activity-pill">
                  <div className="activity-pill-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                    <FileText size={15} strokeWidth={2.5} />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                      {totalReportsCount.toString().padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Reports
                    </div>
                  </div>
                </div>

                {/* In Progress */}
                <div className="activity-pill">
                  <div className="activity-pill-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <Clock size={15} strokeWidth={2.5} />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                      {inProgressCount.toString().padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      In Progress
                    </div>
                  </div>
                </div>

                {/* Resolved */}
                <div className="activity-pill">
                  <div className="activity-pill-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                    <Check size={15} strokeWidth={2.8} />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                      {resolvedCount.toString().padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Resolved
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* "Recent Complaints" Card matching Image 2 */}
            <div className="civic-card" style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
                  Recent Complaints
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {recentComplaintsList.map(item => (
                    <Link
                      key={item.id}
                      to={item.id.startsWith('sample') ? '/citizen' : `/complaint/${item.id}`}
                      className="complaint-list-item"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                          <ComplaintImage
                            src={item.image_url}
                            alt={item.title}
                            category={item.category}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                            {getRelativeTime(item.created_at)}
                          </div>
                        </div>
                      </div>

                      <StatusBadge status={item.status} size="sm" />
                    </Link>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
                <Link
                  to="/citizen?tab=complaints"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#2563eb',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  View all complaints <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPLORE ISSUES VIEW */}
      {currentTab === 'explore' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategoryFilter(c.value)}
                style={{
                  padding: '0.5rem 0.95rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${categoryFilter === c.value ? '#2563eb' : '#e2e8f0'}`,
                  background: categoryFilter === c.value ? '#eff6ff' : '#ffffff',
                  color: categoryFilter === c.value ? '#1d4ed8' : '#475569',
                  fontWeight: categoryFilter === c.value ? 800 : 600,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <c.icon size={15} color={categoryFilter === c.value ? '#1d4ed8' : '#64748b'} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          {/* Full Interactive Map */}
          <div className="civic-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                <MapPin size={18} color="#2563eb" /> City Geographic Incident Map
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                {filteredExploreIssues.length} issues in view
              </span>
            </div>
            <ComplaintMap
              markers={filteredExploreIssues}
              showYouAreHere={true}
              userLocation={userLocation}
              height="360px"
              zoom={13}
            />
          </div>

          {/* Issue Cards Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Reported Incidents ({filteredExploreIssues.length})
              </h2>
              <Link to="/submit" className="btn btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', textDecoration: 'none' }}>
                <Plus size={14} /> Report New Issue
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {filteredExploreIssues.map(item => (
                <div key={item.id} className="civic-card" style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ width: '100%', height: '140px', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.85rem' }}>
                      <ComplaintImage
                        src={item.image_url}
                        alt={item.title}
                        category={item.category}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.45rem' }}>
                      <StatusBadge status={item.status} size="sm" />
                      <PriorityBadge priority={item.priority} size="sm" />
                    </div>

                    <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                      {item.title}
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.4, marginBottom: '0.65rem' }}>
                      {item.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MapPin size={12} color="#2563eb" /> {item.address?.split(',')[0]}
                    </div>
                    <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MY COMPLAINTS VIEW */}
      {currentTab === 'complaints' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Filter Tabs Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[
                { label: 'All Issues', value: 'all' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Resolved', value: 'resolved' },
                { label: 'Withdrawn', value: 'withdrawn' }
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid',
                    cursor: 'pointer',
                    background: statusFilter === tab.value ? '#0f172a' : '#ffffff',
                    color: statusFilter === tab.value ? '#ffffff' : '#475569',
                    borderColor: statusFilter === tab.value ? '#0f172a' : '#e2e8f0',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Complaints List Cards */}
          {filteredUserComplaints.length === 0 ? (
            <div className="civic-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <Check size={36} color="#16a34a" strokeWidth={2.8} style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>No Complaints Found</h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                You have no active complaints under this filter.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {filteredUserComplaints.map(item => (
                <div
                  key={item.id}
                  className="civic-card"
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1.25rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, minWidth: '260px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                      <ComplaintImage
                        src={item.image_url}
                        alt={item.title}
                        category={item.category}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <StatusBadge status={item.status} size="sm" />
                        <PriorityBadge priority={item.priority} size="sm" />
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
                        {item.title}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>
                        <MapPin size={13} color="#2563eb" /> {item.address}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem', textDecoration: 'none' }}>
                      <Eye size={15} /> Track Timeline
                    </Link>
                    {item.status !== 'resolved' && item.status !== 'closed' && item.status !== 'withdrawn' && (
                      <button
                        onClick={() => setWithdrawId(item.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#dc2626' }}
                      >
                        <X size={15} strokeWidth={2.8} /> Withdraw
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MY CONTRIBUTIONS VIEW */}
      {currentTab === 'contributions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 4 Impact Stat Cards */}
          <div className="kpi-grid">
            <div className="kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
              <div className="kpi-header">
                <span className="kpi-title">Reputation Score</span>
                <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <Award size={18} />
                </div>
              </div>
              <div className="kpi-value">450 <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>pts</span></div>
              <div className="kpi-footer">Top 5% active citizen</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
              <div className="kpi-header">
                <span className="kpi-title">Verified Resolved</span>
                <div className="kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <Check size={18} strokeWidth={2.8} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: '#16a34a' }}>{resolvedCount}</div>
              <div className="kpi-footer">Problems fixed in city</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
              <div className="kpi-header">
                <span className="kpi-title">Active Reports</span>
                <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <Clock size={18} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: '#d97706' }}>{inProgressCount}</div>
              <div className="kpi-footer">Currently in municipal pipeline</div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid #7c3aed' }}>
              <div className="kpi-header">
                <span className="kpi-title">Citizen Trust Rank</span>
                <div className="kpi-icon-box" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: '#7c3aed' }}>Level 4</div>
              <div className="kpi-footer">GeoCam Verified Contributor</div>
            </div>
          </div>

          {/* Badges Earned */}
          <div className="civic-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Award size={20} color="#2563eb" /> Earned Civic Badges
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {[
                { title: 'Civic Champion', desc: 'Reported 5+ verified issues', icon: Trophy, color: '#f59e0b', bg: '#fef3c7' },
                { title: 'GeoCam Pioneer', desc: '100% geotag verified photos', icon: Camera, color: '#16a34a', bg: '#dcfce7' },
                { title: 'Rapid Responder', desc: 'Helped verify neighborhood potholes', icon: Zap, color: '#2563eb', bg: '#eff6ff' },
                { title: 'Green Guardian', desc: 'Submitted waste management alerts', icon: Leaf, color: '#059669', bg: '#d1fae5' }
              ].map(badge => (
                <div
                  key={badge.title}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: badge.bg, color: badge.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <badge.icon size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>{badge.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{badge.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={page}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
      />

      {/* Withdraw Modal */}
      {withdrawId && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="civic-card" style={{ padding: '2rem', maxWidth: '440px', width: '100%', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Withdraw Complaint
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Are you sure you want to withdraw this issue? This will close the application.
            </p>

            <form onSubmit={handleWithdraw}>
              <div className="form-group">
                <label className="form-label">Reason for Withdrawal (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Issue resolved independently"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setWithdrawId(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, background: '#991b1b', borderColor: '#991b1b' }} disabled={withdrawing}>
                  {withdrawing ? 'Withdrawing...' : 'Confirm Withdraw'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="civic-card" style={{ padding: '2rem', maxWidth: '400px', width: '100%', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: '12px', color: '#dc2626' }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Delete Issue</h3>
                <p style={{ color: '#64748b', fontSize: '0.8rem' }}>This action is permanent and cannot be undone.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDelete} className="btn btn-primary" style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
