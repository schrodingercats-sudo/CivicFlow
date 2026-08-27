import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { complaintService } from '../services/complaint.service';
import { complianceService, apiRequest, getCachedResponse, setCachedResponse } from '../services/api';
import { useSearch } from '../context/SearchContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { Pagination } from '../components/common/Pagination';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Shield,
  Building2,
  BarChart2,
  Edit,
  RefreshCw,
  Eye,
  Trash2,
  MapPin,
  Users,
  AlertTriangle,
  Clock,
  Check,
  TrendingUp,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
  UserCheck,
  Sparkles,
  Send,
  Calendar,
  Layers,
  CheckCircle2,
  Flame,
  ArrowUpRight,
  Zap,
  Activity,
  Download,
  FileText
} from 'lucide-react';

export const AdminDashboard = () => {
  const { searchQuery, setSearchQuery, refreshKey } = useSearch();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview'; // overview, map, analytics, departments, logs

  // SWR Persistent Cache (Instant 0ms UI Rendering)
  const cachedStats = getCachedResponse('/analytics/summary');
  const cachedComplaints = getCachedResponse('/complaints?limit=100');
  const cachedDepts = getCachedResponse('/departments');
  const cachedWorkers = getCachedResponse('/workers');
  const cachedLogs = getCachedResponse('/compliance/audit-logs');

  const [stats, setStats] = useState(() => cachedStats);
  const [complaints, setComplaints] = useState(() => cachedComplaints?.complaints || []);
  const [departments, setDepartments] = useState(() => Array.isArray(cachedDepts) ? cachedDepts : cachedDepts?.departments || []);
  const [workers, setWorkers] = useState(() => cachedWorkers?.workers || []);
  const [loading, setLoading] = useState(() => !cachedStats && !cachedComplaints);
  const lastHashRef = useRef(JSON.stringify({ stats: cachedStats, complaints: cachedComplaints }));

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState(() => cachedLogs?.logs || []);
  const [soc2Loading, setSoc2Loading] = useState(() => !cachedLogs);
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState('all');

  // Table Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [tableSearch, setTableSearch] = useState('');
  const [isCompact, setIsCompact] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Quick Inspector Drawer
  const [drawerComplaint, setDrawerComplaint] = useState(null);

  // Quick Status Update inside drawer
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [drawerStatus, setDrawerStatus] = useState('');
  const [drawerRemarks, setDrawerRemarks] = useState('');

  // Reassign Modal
  const [reassignModalItem, setReassignModalItem] = useState(null);
  const [selectedDept, setSelectedDept] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Worker Assign Modal
  const [assignWorkerModalItem, setAssignWorkerModalItem] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [assigningWorker, setAssigningWorker] = useState(false);

  // Delete Modal
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Action Menu Popover
  const [actionMenuId, setActionMenuId] = useState(null);

  useEffect(() => {
    loadAdminData();
  }, [refreshKey]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadAuditLogs();
    }
  }, [activeTab]);

  // Sync global search with table search
  useEffect(() => {
    if (searchQuery !== undefined) {
      setTableSearch(searchQuery);
    }
  }, [searchQuery]);

  const loadAdminData = async () => {
    try {
      const [statsRes, complaintsRes, deptsRes, workersRes] = await Promise.all([
        complaintService.getAdminStats().catch(() => null),
        complaintService.getComplaints({ limit: 100 }).catch(() => ({ complaints: [] })),
        complaintService.getDepartments().catch(() => []),
        complaintService.getWorkers().catch(() => ({ workers: [] }))
      ]);

      const newComplaints = complaintsRes.complaints || [];
      const newDepts = Array.isArray(deptsRes) ? deptsRes : deptsRes?.departments || [];
      const newWorkers = workersRes.workers || [];

      const newHash = JSON.stringify({ stats: statsRes, complaints: newComplaints, depts: newDepts, workers: newWorkers });

      if (newHash !== lastHashRef.current) {
        lastHashRef.current = newHash;
        setStats(statsRes);
        setComplaints(newComplaints);
        setDepartments(newDepts);
        setWorkers(newWorkers);
        setCachedResponse('/analytics/summary', statsRes);
        setCachedResponse('/complaints?limit=100', { complaints: newComplaints });
        setCachedResponse('/departments', newDepts);
        setCachedResponse('/workers', { workers: newWorkers });
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setSoc2Loading(true);
    try {
      const logsRes = await complianceService.getAuditLogs({ limit: 100 });
      const logs = logsRes?.logs || [];
      setAuditLogs(logs);
      setCachedResponse('/compliance/audit-logs', { logs });
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setSoc2Loading(false);
    }
  };

  const downloadAuditLog = () => {
    const token = localStorage.getItem('civicflow_token');
    const url = complianceService.downloadAuditLogUrl;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `civicflow-system-audit-log-${Date.now()}.log`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => alert('Failed to download log: ' + err.message));
  };

  const handleOpenDrawer = (item) => {
    setDrawerComplaint(item);
    setDrawerStatus(item.status);
    setDrawerRemarks(item.ai_suggested_response || '');
    setActionMenuId(null);
  };

  const handleCloseDrawer = () => {
    setDrawerComplaint(null);
    setDrawerStatus('');
    setDrawerRemarks('');
  };

  const handleUpdateStatusFromDrawer = async (e) => {
    e.preventDefault();
    if (!drawerComplaint) return;
    setUpdatingStatus(true);
    try {
      await complaintService.updateStatus(drawerComplaint.id, {
        status: drawerStatus,
        remarks: drawerRemarks || `Status updated to ${drawerStatus} by Admin`
      });
      await loadAdminData();
      setDrawerComplaint(prev => ({ ...prev, status: drawerStatus }));
    } catch (err) {
      alert(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignModalItem || !selectedDept) return;
    setReassigning(true);
    try {
      const isRejectedOrWithdrawn = reassignModalItem.status === 'rejected' || reassignModalItem.status === 'withdrawn';
      await complaintService.updateStatus(reassignModalItem.id, {
        department_id: selectedDept,
        status: isRejectedOrWithdrawn ? 'submitted' : reassignModalItem.status,
        remarks: 'Department manually reassigned & reactivated by Administrator'
      });
      setReassignModalItem(null);
      await loadAdminData();
      if (drawerComplaint && drawerComplaint.id === reassignModalItem.id) {
        const updatedDept = departments.find(d => d.id === selectedDept);
        setDrawerComplaint(prev => ({ ...prev, department_id: selectedDept, cf_departments: updatedDept }));
      }
    } catch (err) {
      alert(err.message || 'Failed to reassign department');
    } finally {
      setReassigning(false);
    }
  };

  const handleAssignWorkerSubmit = async (e) => {
    e.preventDefault();
    if (!assignWorkerModalItem || !selectedWorkerId) return;
    setAssigningWorker(true);
    try {
      await complaintService.assignWorker(assignWorkerModalItem.id, selectedWorkerId);
      setAssignWorkerModalItem(null);
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to assign worker');
    } finally {
      setAssigningWorker(false);
    }
  };

  const handleDeleteComplaint = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await complaintService.deleteComplaint(deleteId);
      setDeleteId(null);
      if (drawerComplaint && drawerComplaint.id === deleteId) {
        setDrawerComplaint(null);
      }
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to delete complaint');
    } finally {
      setDeleting(false);
    }
  };

  // KPI Calculations
  const totalCount = stats?.total_complaints ?? complaints.length;
  const openCount = stats?.pending_action ?? complaints.filter(c => ['submitted', 'under_review'].includes(c.status)).length;
  const inProgressCount = complaints.filter(c => c.status === 'in_progress' || c.status === 'assigned').length;
  const resolvedCount = stats?.resolved_closed ?? complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;

  // Filtered & Searched Data
  const filteredComplaints = useMemo(() => {
    return complaints.filter(item => {
      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        const matchesAddress = item.address?.toLowerCase().includes(query);
        const matchesDept = item.cf_departments?.name?.toLowerCase().includes(query);
        const matchesCitizen = item.citizen?.name?.toLowerCase().includes(query) || item.cf_users?.name?.toLowerCase().includes(query);
        const matchesId = item.id?.toLowerCase().includes(query) || `iss-${item.id.slice(0, 4)}`.includes(query);
        if (!matchesTitle && !matchesDesc && !matchesAddress && !matchesDept && !matchesCitizen && !matchesId) {
          return false;
        }
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'open' && !['submitted', 'under_review'].includes(item.status)) return false;
        if (statusFilter === 'in_progress' && !['in_progress', 'assigned'].includes(item.status)) return false;
        if (statusFilter === 'resolved' && !['resolved', 'closed'].includes(item.status)) return false;
        if (statusFilter === 'critical' && item.priority !== 'critical') return false;
      }

      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false;
      }

      if (deptFilter !== 'all' && item.department_id !== deptFilter) {
        return false;
      }

      return true;
    });
  }, [complaints, tableSearch, statusFilter, priorityFilter, deptFilter]);

  // Paginated Data
  const totalPages = Math.ceil(filteredComplaints.length / pageSize) || 1;
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredComplaints.slice(start, start + pageSize);
  }, [filteredComplaints, currentPage, pageSize]);

  // Derive department workload
  const departmentStats = useMemo(() => {
    return (departments || []).map(dept => {
      const dc = complaints.filter(c => c.department_id === dept.id);
      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        total: dc.length,
        pending: dc.filter(c => !['resolved', 'closed', 'rejected', 'withdrawn'].includes(c.status)).length,
        resolved: dc.filter(c => c.status === 'resolved' || c.status === 'closed').length
      };
    });
  }, [departments, complaints]);

  // Category Distribution
  const categoryDist = useMemo(() => {
    const counts = {};
    complaints.forEach(c => {
      const cat = c.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [complaints]);

  // Filtered audit logs
  const filteredLogs = auditLogs.filter(log => {
    if (logFilter !== 'all' && log.event_type?.toLowerCase() !== logFilter.toLowerCase()) {
      return false;
    }
    if (logSearch) {
      const q = logSearch.toLowerCase();
      return (
        log.details?.toLowerCase().includes(q) ||
        log.endpoint?.toLowerCase().includes(q) ||
        log.event_type?.toLowerCase().includes(q) ||
        log.actor?.email?.toLowerCase().includes(q) ||
        log.soc2_control?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AppLayout
      headerTitle="Executive Admin Dashboard"
      headerSubtitle="City-wide infrastructure triage, SLA analytics & security logs"
    >
      {/* 4 KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="kpi-header">
            <span className="kpi-title">Open Issues</span>
            <div className="kpi-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <AlertTriangle size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value">{openCount}</div>
          <div className="kpi-footer">Requires municipal triage</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-header">
            <span className="kpi-title">In Progress</span>
            <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Clock size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value">{inProgressCount}</div>
          <div className="kpi-footer">Field work active</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-header">
            <span className="kpi-title">Resolved & Closed</span>
            <div className="kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <Check size={18} strokeWidth={2.8} />
            </div>
          </div>
          <div className="kpi-value">{resolvedCount}</div>
          <div className="kpi-footer">Verified fixes</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">Resolution Rate</span>
            <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value">{stats?.resolution_rate ?? 78}%</div>
          <div className="kpi-footer">City performance index</div>
        </div>
      </div>

      {/* ── TAB 1: OVERVIEW (City Triage Table & Controls) ── */}
      {(activeTab === 'overview' || !activeTab) && (
        <div className="civic-card" style={{ padding: '1.5rem' }}>
          {/* Table Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter issues..."
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.65rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', outline: 'none', background: '#fff' }}
              >
                <option value="all">All Statuses</option>
                <option value="open">Open / Submitted</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="critical">Critical Priority Only</option>
              </select>

              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', outline: 'none', background: '#fff' }}
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              Showing {paginatedComplaints.length} of {filteredComplaints.length} incidents
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="desktop-only" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Issue</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedComplaints.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a', maxWidth: '260px' }}>
                      <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>{item.address}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textTransform: 'capitalize', color: '#334155' }}>
                      {item.category?.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <PriorityBadge priority={item.priority} size="sm" />
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600 }}>
                      {item.cf_departments?.name || 'Unassigned'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleOpenDrawer(item)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        >
                          <Eye size={13} /> Inspect
                        </button>
                        <button
                          onClick={() => { setReassignModalItem(item); setSelectedDept(item.department_id || ''); }}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#dc2626' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredComplaints.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {/* ── TAB 2: ISSUES MAP ── */}
      {activeTab === 'map' && (
        <div className="civic-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <MapPin size={20} color="#2563eb" /> Live City Incident Spatial Map
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>Real-time GPS pin map across all municipal jurisdictions</p>
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '0.3rem 0.75rem', borderRadius: '999px' }}>
              ● {complaints.length} Total Incidents
            </span>
          </div>

          <ComplaintMap
            markers={complaints}
            height="550px"
            zoom={12}
          />
        </div>
      )}

      {/* ── TAB 3: ANALYTICS ── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Department Breakdown */}
          <div className="civic-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} color="#2563eb" /> Department Workload Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {departmentStats.map(dept => (
                <div key={dept.id} style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{dept.name} ({dept.code})</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Municipal Unit</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Total</div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{dept.total}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#b45309', textTransform: 'uppercase' }}>Pending</div>
                      <div style={{ fontWeight: 800, color: '#b45309' }}>{dept.pending}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#15803d', textTransform: 'uppercase' }}>Resolved</div>
                      <div style={{ fontWeight: 800, color: '#15803d' }}>{dept.resolved}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Distribution */}
          <div className="civic-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={18} color="#2563eb" /> Category Distribution
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {Object.entries(categoryDist).map(([category, count]) => (
                <div key={category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <span style={{ textTransform: 'capitalize', color: '#334155', fontWeight: 600 }}>{category.replace('_', ' ')}</span>
                  <span style={{ fontWeight: 800, color: '#0f172a', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: DEPARTMENTS ── */}
      {activeTab === 'departments' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {departments.map(dept => {
            const count = complaints.filter(c => c.department_id === dept.id).length;
            const workersInDept = workers.filter(w => w.department_id === dept.id).length;
            return (
              <div key={dept.id} className="civic-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={20} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', background: '#f1f5f9', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
                    {dept.code}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>{dept.name}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>{count} Complaints</span>
                  <span>{workersInDept} Field Workers</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 5: SYSTEM AUDIT LOGS ── */}
      {activeTab === 'logs' && (
        <div>
          {/* Header Action Bar */}
          <div className="civic-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>System Audit Logs</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Live chronological log trail of all user actions, security triggers & API traffic</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '0.35rem 0.75rem', borderRadius: '999px' }}>
                {auditLogs.length} Total Events
              </span>
              <button
                onClick={downloadAuditLog}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Download size={15} /> Download Log File (.log)
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search audit logs by endpoint, email, details..."
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.85rem 0.6rem 2.25rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
              />
            </div>
            <select
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
              style={{ padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#fff' }}
            >
              <option value="all">All Event Types</option>
              <option value="AUTH_LOGIN">AUTH_LOGIN</option>
              <option value="AUTH_REGISTER">AUTH_REGISTER</option>
              <option value="COMPLAINT_CREATED">COMPLAINT_CREATED</option>
              <option value="WORKER_ASSIGNED">WORKER_ASSIGNED</option>
              <option value="FIELD_WORKER_UPDATE">FIELD_WORKER_UPDATE</option>
              <option value="COMPLAINT_STATUS_UPDATE">COMPLAINT_STATUS_UPDATE</option>
              <option value="RATE_LIMIT_EXCEEDED">RATE_LIMIT_EXCEEDED (429)</option>
              <option value="API_REQUEST">API_REQUEST</option>
            </select>
          </div>

          {/* Live Audit Log Stream Table */}
          <div className="civic-card" style={{ padding: '1.25rem', overflow: 'hidden' }}>
            {soc2Loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading live audit stream...</div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                No audit log events match your filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2 }}>
                    <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Timestamp</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Event Type</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Actor</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Endpoint</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Latency</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(entry => {
                      const isError = entry.status_code >= 400;
                      const isRateLimit = entry.status_code === 429;
                      return (
                        <tr key={entry.event_id} style={{ borderBottom: '1px solid #f1f5f9', background: isRateLimit ? '#fffbeb' : isError ? '#fef2f2' : 'transparent' }}>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                            <span style={{
                              padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', textTransform: 'uppercase',
                              background: isRateLimit ? '#fef3c7' : isError ? '#fee2e2' : '#eff6ff',
                              color: isRateLimit ? '#b45309' : isError ? '#dc2626' : '#2563eb'
                            }}>
                              {entry.event_type}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                            <div style={{ fontWeight: 600 }}>{entry.actor?.email || 'Guest'}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{entry.actor?.role || 'public'}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', color: '#0f172a', fontSize: '0.75rem' }}>
                            <strong>{entry.method}</strong> {entry.endpoint}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{
                              padding: '0.15rem 0.45rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800,
                              background: isRateLimit ? '#fef3c7' : isError ? '#fee2e2' : '#dcfce7',
                              color: isRateLimit ? '#b45309' : isError ? '#991b1b' : '#166534'
                            }}>
                              {entry.status_code}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.75rem' }}>
                            {entry.latency_ms}ms
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#475569', fontSize: '0.75rem', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entry.details}>
                            {entry.details}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Inspector Drawer ── */}
      {drawerComplaint && (
        <div className="drawer-overlay" onClick={handleCloseDrawer}>
          <div className="drawer-panel" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StatusBadge status={drawerComplaint.status} size="sm" />
                <PriorityBadge priority={drawerComplaint.priority} size="sm" />
              </div>
              <button
                onClick={handleCloseDrawer}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                title="Close Drawer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', lineHeight: 1.25 }}>
                {drawerComplaint.title}
              </h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>
                <MapPin size={14} color="#2563eb" />
                <span>{drawerComplaint.address || 'Reported Location'}</span>
              </div>

              {drawerComplaint.image_url && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <ComplaintImage
                    src={drawerComplaint.image_url}
                    alt={drawerComplaint.title}
                    category={drawerComplaint.category}
                    style={{ width: '100%', height: '180px', borderRadius: '10px' }}
                  />
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Description
                </div>
                <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
                  {drawerComplaint.description}
                </p>
              </div>

              {/* Fast Status Update Form inside Drawer */}
              <form onSubmit={handleUpdateStatusFromDrawer} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.15rem', borderRadius: '12px', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Zap size={14} color="#2563eb" /> Quick Status Action
                </div>

                <div className="form-group">
                  <label className="form-label">Set New Status</label>
                  <select
                    className="form-select"
                    value={drawerStatus}
                    onChange={(e) => setDrawerStatus(e.target.value)}
                  >
                    <option value="submitted">Submitted (Pending Action)</option>
                    <option value="in_progress">In Progress (Work Dispatched)</option>
                    <option value="resolved">Resolved (Work Completed)</option>
                    <option value="rejected">Rejected (Invalid/Duplicate)</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Admin Notes / Remarks</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Enter official triage remarks or instructions..."
                    value={drawerRemarks}
                    onChange={(e) => setDrawerRemarks(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.65rem' }}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? 'Updating...' : 'Save Status Update'}
                </button>
              </form>
            </div>

            <div className="drawer-footer">
              <Link
                to={`/complaint/${drawerComplaint.id}`}
                className="btn btn-secondary"
                style={{ flex: 1, textDecoration: 'none' }}
              >
                Full Inspection Page <ArrowUpRight size={14} />
              </Link>
              <button
                onClick={() => { setReassignModalItem(drawerComplaint); setSelectedDept(drawerComplaint.department_id || ''); }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Reassign Dept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reassign Department Modal ── */}
      {reassignModalItem && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="civic-card" style={{ padding: '2rem', maxWidth: '440px', width: '100%', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
              Reassign Department
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select a target municipal department for "{reassignModalItem.title}".
            </p>

            <form onSubmit={handleReassignSubmit}>
              <div className="form-group">
                <label className="form-label">Target Department</label>
                <select
                  className="form-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  required
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setReassignModalItem(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={reassigning}>
                  {reassigning ? 'Saving...' : 'Save Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dispatch Worker Modal ── */}
      {assignWorkerModalItem && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="civic-card" style={{ padding: '2rem', maxWidth: '440px', width: '100%', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
              Dispatch Field Worker
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Assign on-site personnel for "{assignWorkerModalItem.title}".
            </p>

            <form onSubmit={handleAssignWorkerSubmit}>
              <div className="form-group">
                <label className="form-label">Select Field Worker</label>
                <select
                  className="form-select"
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  required
                >
                  <option value="">-- Select Worker --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.cf_departments?.name || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setAssignWorkerModalItem(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={assigningWorker}>
                  {assigningWorker ? 'Dispatching...' : 'Dispatch Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
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
                <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Permanently remove this civic issue record.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDeleteComplaint} className="btn btn-primary" style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
