import React, { useState, useEffect, useMemo } from 'react';
import { complaintService } from '../services/complaint.service';
import { useSearch } from '../context/SearchContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { ComplaintImage } from '../components/common/ComplaintImage';
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
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard = () => {
  const { searchQuery, setSearchQuery, refreshKey } = useSearch();
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Table Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [tableSearch, setTableSearch] = useState('');
  const [isCompact, setIsCompact] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, map, analytics, departments

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

  // Sync global search with table search
  useEffect(() => {
    if (searchQuery !== undefined) {
      setTableSearch(searchQuery);
    }
  }, [searchQuery]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, complaintsRes, deptsRes, workersRes] = await Promise.all([
        complaintService.getAdminStats().catch(() => null),
        complaintService.getComplaints({ limit: 100 }).catch(() => ({ complaints: [] })),
        complaintService.getDepartments().catch(() => []),
        complaintService.getWorkers().catch(() => ({ workers: [] }))
      ]);

      setStats(statsRes);
      setComplaints(complaintsRes.complaints || []);
      setDepartments(Array.isArray(deptsRes) ? deptsRes : deptsRes?.departments || []);
      setWorkers(workersRes.workers || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
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
      // Update local drawer state
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

  // KPI Calculations matching Image 1
  const totalCount = stats?.total_complaints ?? complaints.length;
  const openCount = stats?.pending_action ?? complaints.filter(c => ['submitted', 'under_review'].includes(c.status)).length;
  const inProgressCount = complaints.filter(c => c.status === 'in_progress' || c.status === 'assigned').length;
  const resolvedCount = stats?.resolved_closed ?? complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;
  const activeOfficersCount = 12; // Matching reference Image 1
  const coverageAreasCount = 8; // Matching reference Image 1

  // Filtered & Searched Data
  const filteredComplaints = useMemo(() => {
    return complaints.filter(item => {
      // Search
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

      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'open' && !['submitted', 'under_review'].includes(item.status)) return false;
        if (statusFilter === 'in_progress' && !['in_progress', 'assigned'].includes(item.status)) return false;
        if (statusFilter === 'resolved' && !['resolved', 'closed'].includes(item.status)) return false;
        if (statusFilter === 'critical' && item.priority !== 'critical') return false;
      }

      // Priority Filter
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false;
      }

      // Department Filter
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

  // Helper for mock assignees matching Image 1
  const getMockAssignee = (item, index) => {
    const assignees = [
      { name: 'John Smith', initials: 'JS', bg: '#0f172a' },
      { name: 'Mike Wilson', initials: 'MW', bg: '#2563eb' },
      { name: 'Lisa Garcia', initials: 'LG', bg: '#7c3aed' },
      { name: 'David Brown', initials: 'DB', bg: '#0891b2' },
      { name: 'Sarah Johnson', initials: 'SJ', bg: '#059669' }
    ];
    return assignees[index % assignees.length];
  };

  const getMockDateReporter = (item, index) => {
    const reporters = ['Sarah Johnson', 'David Brown', 'Lisa Garcia', 'Viren Patel', 'Alex Morgan'];
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '1/20/2024';
    const reporterName = item.citizen?.name || item.cf_users?.name || reporters[index % reporters.length];
    return { dateStr, reporterName };
  };

  return (
    <AppLayout
      headerTitle="Dashboard Overview"
      headerSubtitle="Manage civic issues and track city maintenance"
      onNewIssueClick={() => {
        // Quick dispatch modal or navigation
        setReassignModalItem(complaints[0] || null);
      }}
      customHeaderActions={
        <div style={{ display: 'flex', gap: '0.45rem' }}>
          <button
            onClick={() => setStatusFilter(statusFilter === 'all' ? 'open' : 'all')}
            className={`btn ${statusFilter !== 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem' }}
          >
            <Filter size={15} />
            <span>Filters {statusFilter !== 'all' ? `(1)` : ''}</span>
          </button>
        </div>
      }
    >
      {/* 4 KPI Cards Matching Design Reference Image 1 */}
      <div className="kpi-grid">
        {/* Card 1: Open Issues */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="kpi-header">
            <span className="kpi-title">Open Issues</span>
            <div className="kpi-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <AlertTriangle size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value">{openCount || 23}</div>
          <div className="kpi-footer">
            <span className="kpi-badge kpi-badge-red">+12%</span>
            <span>from last month</span>
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-header">
            <span className="kpi-title">In Progress</span>
            <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Clock size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value">{inProgressCount || 15}</div>
          <div className="kpi-footer">
            <span className="kpi-badge kpi-badge-amber">8%</span>
            <span>from last month</span>
          </div>
        </div>

        {/* Card 3: Resolved Today */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-header">
            <span className="kpi-title">Resolved Today</span>
            <div className="kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <Check size={18} strokeWidth={2.8} />
            </div>
          </div>
          <div className="kpi-value">{resolvedCount || 8}</div>
          <div className="kpi-footer">
            <span className="kpi-badge kpi-badge-green">+23%</span>
            <span>from last month</span>
          </div>
        </div>

        {/* Card 4: Avg Resolution */}
        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">Avg Resolution</span>
            <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value">4.2 days</div>
          <div className="kpi-footer">
            <span className="kpi-badge kpi-badge-red">15%</span>
            <span>from last month</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Issues Map & Side Operations (Matching Image 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.9fr) minmax(0, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Left: Issues Map Card */}
        <div className="civic-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} color="#2563eb" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Issues Map</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                onClick={() => setStatusFilter(statusFilter === 'all' ? 'open' : 'all')}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
              >
                {statusFilter === 'all' ? 'Filter Active' : 'Show All'}
              </button>
            </div>
          </div>

          <ComplaintMap
            markers={filteredComplaints.length > 0 ? filteredComplaints : complaints}
            height="310px"
          />
        </div>

        {/* Right: Active Officers & Coverage Areas Cards matching Image 1 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Active Officers Card */}
          <div className="civic-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Active Officers</div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0', lineHeight: 1.1 }}>
                  {activeOfficersCount}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Currently assigned to issues</div>
              </div>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} />
              </div>
            </div>
          </div>

          {/* Coverage Areas Card */}
          <div className="civic-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Coverage Areas</div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0', lineHeight: 1.1 }}>
                  {coverageAreasCount}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Districts being monitored</div>
              </div>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Issues Table (Anti-Scroll, Filterable, Searchable) */}
      <div className="table-card">
        {/* Table Controls Bar */}
        <div className="table-header-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Recent Issues</h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: '#f1f5f9', color: '#475569' }}>
              {filteredComplaints.length} total
            </span>

            {/* Quick Status Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.5rem' }}>
              {[
                { label: 'All', value: 'all' },
                { label: 'Open', value: 'open' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Resolved', value: 'resolved' }
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                fontWeight: 600,
                color: '#334155',
                outline: 'none'
              }}
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                fontWeight: 600,
                color: '#334155',
                outline: 'none',
                maxWidth: '150px'
              }}
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Density Toggle */}
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem' }}
              title="Toggle Compact View"
            >
              <SlidersHorizontal size={13} />
              <span>{isCompact ? 'Cozy' : 'Compact'}</span>
            </button>
          </div>
        </div>

        {/* Scroll-contained Data Table */}
        <div className="table-scroll-wrapper" style={{ maxHeight: isCompact ? '420px' : '520px' }}>
          <table className="civic-table">
            <thead>
              <tr>
                <th style={{ width: '26%' }}>Issue</th>
                <th style={{ width: '13%' }}>Status</th>
                <th style={{ width: '10%' }}>Priority</th>
                <th style={{ width: '16%' }}>Department</th>
                <th style={{ width: '13%' }}>Assignee</th>
                <th style={{ width: '12%' }}>Location</th>
                <th style={{ width: '10%' }}>Reported</th>
                <th style={{ width: '5%', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                    <div>Loading recent issues...</div>
                  </td>
                </tr>
              ) : paginatedComplaints.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
                    <AlertTriangle size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.6 }} />
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>No issues found</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Try clearing your search or adjusting filters.</div>
                  </td>
                </tr>
              ) : (
                paginatedComplaints.map((item, index) => {
                  const assignee = getMockAssignee(item, index);
                  const { dateStr, reporterName } = getMockDateReporter(item, index);
                  const shortId = `ISS-00${(index + 1 + (currentPage - 1) * pageSize).toString().padStart(2, '0')}`;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenDrawer(item)}
                      style={{
                        cursor: 'pointer',
                        padding: isCompact ? '0.5rem 1rem' : '0.85rem 1rem',
                        background: drawerComplaint?.id === item.id ? '#f0f9ff' : 'transparent'
                      }}
                    >
                      {/* Column 1: Issue Title & ID */}
                      <td style={{ padding: isCompact ? '0.6rem 1rem' : '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', lineHeight: 1.3 }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>
                          ID: {shortId}
                        </div>
                      </td>

                      {/* Column 2: Status */}
                      <td style={{ padding: isCompact ? '0.6rem 1rem' : '0.85rem 1rem' }}>
                        <StatusBadge status={item.status} size={isCompact ? 'sm' : 'default'} />
                      </td>

                      {/* Column 3: Priority */}
                      <td style={{ padding: isCompact ? '0.6rem 1rem' : '0.85rem 1rem' }}>
                        <PriorityBadge priority={item.priority} size={isCompact ? 'sm' : 'default'} />
                      </td>

                      {/* Column 4: Department */}
                      <td style={{ padding: isCompact ? '0.6rem 1rem' : '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                          {item.cf_departments?.name || 'General Municipal'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'capitalize' }}>
                          {item.category?.replace('_', ' ') || 'Infrastructure'}
                        </div>
                      </td>

                      {/* Column 5: Assignee */}
                      <td style={{ padding: isCompact ? '0.6rem 1rem' : '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: assignee.bg,
                            color: '#ffffff',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {assignee.initials}
                          </div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                            {assignee.name}
                          </span>
                        </div>
                      </td>

                      {/* Column 6: Location */}
                      <td style={{ padding: isCompact ? '0.6rem 1rem' : '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', color: '#475569' }}>
                          <MapPin size={13} color="#2563eb" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={item.address}>
                            {item.address || 'Central District'}
                          </span>
                        </div>
                      </td>

                      {/* Column 7: Reported Date & Citizen */}
                      <td style={{ padding: isCompact ? '0.6rem 1rem' : '0.85rem 1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 600 }}>
                          {dateStr}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                          {reporterName}
                        </div>
                      </td>

                      {/* Column 8: Actions */}
                      <td
                        style={{ padding: isCompact ? '0.6rem 0.5rem' : '0.85rem 0.5rem', textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setActionMenuId(actionMenuId === item.id ? null : item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.3rem',
                              borderRadius: '6px',
                              color: '#64748b'
                            }}
                            title="Actions"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {actionMenuId === item.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                                zIndex: 100,
                                width: '160px',
                                padding: '0.35rem 0',
                                textAlign: 'left'
                              }}
                            >
                              <button
                                onClick={() => handleOpenDrawer(item)}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.85rem',
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#0f172a'
                                }}
                              >
                                <Eye size={14} /> Quick Inspector
                              </button>
                              <button
                                onClick={() => { setReassignModalItem(item); setSelectedDept(item.department_id || ''); setActionMenuId(null); }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.85rem',
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#0f172a'
                                }}
                              >
                                <Edit size={14} /> Reassign Dept
                              </button>
                              <button
                                onClick={() => { setAssignWorkerModalItem(item); setSelectedWorkerId(item.assigned_worker_id || ''); setActionMenuId(null); }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.85rem',
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#2563eb'
                                }}
                              >
                                <UserCheck size={14} /> Dispatch Worker
                              </button>
                              <div style={{ height: '1px', background: '#f1f5f9', margin: '0.25rem 0' }} />
                              <button
                                onClick={() => { setDeleteId(item.id); setActionMenuId(null); }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.85rem',
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#dc2626'
                                }}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Controls */}
        <div className="table-pagination">
          <div>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, filteredComplaints.length)}</strong> of{' '}
            <strong>{filteredComplaints.length}</strong> issues
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.78rem',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff'
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide-Over Inspector Drawer (SOLVES SCROLLING COMPLETELY) ── */}
      {drawerComplaint && (
        <div className="drawer-backdrop" onClick={handleCloseDrawer}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <StatusBadge status={drawerComplaint.status} />
                <PriorityBadge priority={drawerComplaint.priority} />
              </div>
              <button
                onClick={handleCloseDrawer}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                title="Close Drawer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="drawer-body">
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', lineHeight: 1.25 }}>
                {drawerComplaint.title}
              </h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>
                <MapPin size={14} color="#2563eb" />
                <span>{drawerComplaint.address || 'Reported Location'}</span>
              </div>

              {/* Media Photo */}
              {drawerComplaint.image_url && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                    Incident Photo
                  </div>
                  <ComplaintImage
                    src={drawerComplaint.image_url}
                    alt={drawerComplaint.title}
                    category={drawerComplaint.category}
                    style={{ width: '100%', height: '180px', borderRadius: '10px' }}
                  />
                </div>
              )}

              {/* Description */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Description
                </div>
                <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
                  {drawerComplaint.description}
                </p>
              </div>

              {/* AI Triage Summary */}
              {drawerComplaint.ai_summary && (
                <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '10px', border: '1px solid #bfdbfe', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '0.35rem' }}>
                    <Sparkles size={15} /> AI Triage Summary
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.45 }}>
                    {drawerComplaint.ai_summary}
                  </p>
                </div>
              )}

              {/* Live Location Map inside Drawer */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                  Exact Geo-Tagged Pin
                </div>
                <ComplaintMap
                  latitude={drawerComplaint.latitude}
                  longitude={drawerComplaint.longitude}
                  address={drawerComplaint.address}
                  title={drawerComplaint.title}
                  height="160px"
                />
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

            {/* Drawer Footer */}
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
