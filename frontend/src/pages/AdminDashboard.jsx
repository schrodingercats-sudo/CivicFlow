import React, { useState, useEffect } from 'react';
import { complaintService } from '../services/complaint.service';
import { complianceService, apiRequest } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { Pagination } from '../components/common/Pagination';
import { Shield, Building2, BarChart2, Edit, RefreshCw, Eye, Trash2, MapPin, ShieldCheck, Lock, Activity, Download, Search, AlertCircle, Zap, FileText, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'soc2'
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // SOC 2 & Audit state
  const [soc2Data, setSoc2Data] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [soc2Loading, setSoc2Loading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState('all');

  const [reassignModalItem, setReassignModalItem] = useState(null);
  const [selectedDept, setSelectedDept] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, [page, pageSize]);

  useEffect(() => {
    if (activeTab === 'soc2') {
      loadSoc2Data();
    }
  }, [activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, complaintsRes, deptsRes] = await Promise.all([
        complaintService.getAdminStats(),
        complaintService.getComplaints({ page, limit: pageSize }),
        complaintService.getDepartments()
      ]);
      setStats(statsRes);
      setComplaints(complaintsRes.complaints || []);
      setTotalItems(complaintsRes.total ?? (complaintsRes.complaints?.length || 0));
      setDepartments(Array.isArray(deptsRes) ? deptsRes : deptsRes?.departments || []);
    } catch (err) {
      console.error('Failed to load admin metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSoc2Data = async () => {
    setSoc2Loading(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        complianceService.getSoc2Status(),
        complianceService.getAuditLogs({ limit: 100 })
      ]);
      setSoc2Data(statusRes);
      setAuditLogs(logsRes?.logs || []);
    } catch (err) {
      console.error('Failed to load SOC2 compliance metrics:', err);
    } finally {
      setSoc2Loading(false);
    }
  };

  const simulateRateLimit = async () => {
    try {
      await apiRequest('/departments?test_rate_limit=1');
    } catch (err) {
      // Caught and triggers 429 event
      if (activeTab === 'soc2') loadSoc2Data();
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
        a.download = `civicflow-soc2-audit-log-${Date.now()}.log`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => alert('Failed to download log: ' + err.message));
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
    } catch (err) {
      alert(err.message || 'Failed to reassign department');
    } finally {
      setReassigning(false);
    }
  };

  const handleDeleteComplaint = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await complaintService.deleteComplaint(deleteId);
      setDeleteId(null);
      await loadAdminData();
    } catch (err) {
      alert(err.message || 'Failed to delete complaint');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading Admin Analytics...</div>;

  // Stats API returns flat snake_case fields: total_complaints, pending_action, resolved_closed, critical_escalations, resolution_rate
  const totalComplaintsCount = stats?.total_complaints ?? complaints.length;
  const pendingCount = stats?.pending_action ?? complaints.filter(c => ['submitted', 'in_progress', 'assigned', 'under_review'].includes(c.status)).length;
  const resolvedCount = stats?.resolved_closed ?? complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;
  const criticalCount = stats?.critical_escalations ?? complaints.filter(c => c.priority === 'critical' && c.status !== 'resolved' && c.status !== 'closed' && c.status !== 'withdrawn').length;

  // Derive department stats and category distribution from loaded data (API doesn't return these nested)
  const departmentStats = (departments || []).map(dept => {
    const dc = complaints.filter(c => c.department_id === dept.id);
    return { id: dept.id, name: dept.name, code: dept.code, total: dc.length, pending: dc.filter(c => !['resolved', 'closed', 'rejected', 'withdrawn'].includes(c.status)).length, resolved: dc.filter(c => c.status === 'resolved' || c.status === 'closed').length };
  });
  const categoryDist = complaints.reduce((acc, c) => { if (c.category) acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {});

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
    <div>
      <div className="responsive-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 5vw, 1.8rem)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', lineHeight: 1.2 }}>
            <Shield size={24} color="#0f172a" style={{ flexShrink: 0 }} /> Executive Admin Dashboard
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>City-wide infrastructure triage, SLA analytics & security audit logs</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activeTab === 'soc2' ? (
            <button onClick={loadSoc2Data} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <RefreshCw size={15} /> Refresh Logs
            </button>
          ) : (
            <button onClick={loadAdminData} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <RefreshCw size={15} /> Refresh Metrics
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: activeTab === 'overview' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'overview' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s'
          }}
        >
          <BarChart2 size={16} /> Overview & City Triage
        </button>
        <button
          onClick={() => setActiveTab('soc2')}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: activeTab === 'soc2' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'soc2' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s'
          }}
        >
          <Activity size={16} color={activeTab === 'soc2' ? '#38bdf8' : '#2563eb'} /> System Audit Logs
        </button>
      </div>

      {/* TAB 1: OVERVIEW & CITY TRIAGE */}
      {activeTab === 'overview' && (
        <>
          {/* Metric Cards */}
          <div className="grid-4" style={{ marginBottom: '2rem' }}>
            <div className="clay-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Complaints</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0' }}>{totalComplaintsCount}</div>
              <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>100% Tracked</div>
            </div>

            <div className="clay-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Pending Action</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b45309', margin: '0.3rem 0' }}>{pendingCount}</div>
              <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Requires Dispatch</div>
            </div>

            <div className="clay-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Resolved & Closed</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803d', margin: '0.3rem 0' }}>{resolvedCount}</div>
              <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>Resolution Success Rate</div>
            </div>

            <div className="clay-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Critical Escalations</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626', margin: '0.3rem 0' }}>{criticalCount}</div>
              <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Immediate Field Dispatch</div>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="grid-2-1" style={{ marginBottom: '2rem' }}>
            <div className="clay-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} /> Department Workload Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {departmentStats.map(dept => (
                  <div key={dept.id} style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{dept.name} ({dept.code})</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Active Officers Assigned</div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total</div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{dept.total ?? dept.totalComplaints ?? 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#b45309' }}>Pending</div>
                        <div style={{ fontWeight: 800, color: '#b45309' }}>{dept.pending ?? dept.pendingComplaints ?? 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#15803d' }}>Resolved</div>
                        <div style={{ fontWeight: 800, color: '#15803d' }}>{dept.resolved ?? dept.resolvedComplaints ?? 0}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="clay-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart2 size={18} /> Category Distribution
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(categoryDist).map(([category, count]) => (
                  <div key={category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                    <span style={{ textTransform: 'capitalize', color: '#334155', fontWeight: 600 }}>{category.replace('_', ' ')}</span>
                    <span style={{ fontWeight: 800, color: '#0f172a', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full-Width City Heat Map */}
          <div className="clay-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={20} color="#2563eb" /> Live City Geographic Map & Incident Triage
              </h3>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '0.25rem 0.65rem', borderRadius: '999px', border: '1px solid #bbf7d0' }}>
                ● {complaints.length} Incidents Plot
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Interactive GPS incident mapping across all municipal jurisdictions. Click any pin to open complaint details.
            </p>
            <ComplaintMap
              complaints={complaints}
              height="450px"
              center={[19.0760, 72.8777]}
              zoom={11}
            />
          </div>

          {/* Recent Complaints Table */}
          <div className="clay-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem' }}>
              City-Wide Incident Triage Log
            </h3>
            
            <div className="desktop-only" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Issue</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                        {item.title}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textTransform: 'capitalize', color: '#334155' }}>
                        {item.category.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <StatusBadge status={item.status} />
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontWeight: 600 }}>
                        {item.cf_departments?.name || 'Unassigned'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                          <Eye size={14} /> View
                        </Link>
                        <button
                          onClick={() => { setReassignModalItem(item); setSelectedDept(item.department_id || ''); }}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        >
                          <Edit size={14} /> Reassign
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}
                          title="Delete Complaint"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (<=768px) */}
            <div className="mobile-only">
              {complaints.map(item => (
                <div key={item.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{item.title}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <StatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>{item.category.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    <strong>Dept:</strong> {item.cf_departments?.name || 'Unassigned'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <Link to={`/complaint/${item.id}`} className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem', justifyContent: 'center', textDecoration: 'none' }}>
                      <Eye size={14} /> View
                    </Link>
                    <button
                      onClick={() => { setReassignModalItem(item); setSelectedDept(item.department_id || ''); }}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem', justifyContent: 'center' }}
                    >
                      <Edit size={14} /> Reassign
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2', justifyContent: 'center' }}
                      title="Delete Complaint"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

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
          </div>
        </>
      )}

      {/* TAB 2: SYSTEM SECURITY & AUDIT LOGS */}
      {activeTab === 'soc2' && (
        <div>
          {/* Header Action Bar */}
          <div className="clay-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
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
                placeholder="Search audit logs by endpoint, email, details or control..."
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
          <div className="clay-card" style={{ padding: '1.25rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Activity size={18} color="#2563eb" /> Real-Time SOC 2 Structured Audit Log Stream
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                Showing {filteredLogs.length} of {auditLogs.length} events
              </span>
            </div>

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
                      <th style={{ padding: '0.65rem 0.85rem' }}>SOC-2 Tag</th>
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
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#0f172a' }}>
                            <span style={{ padding: '0.15rem 0.45rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.7rem' }}>
                              {entry.soc2_control}
                            </span>
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

      {reassignModalItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="clay-card" style={{ padding: '2rem', maxWidth: '460px', width: '100%', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Reassign Complaint Department
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select a new municipal department to take ownership of "{reassignModalItem.title}".
            </p>

            <form onSubmit={handleReassignSubmit}>
              <div className="form-group">
                <label className="form-label">Select Target Department</label>
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
                  {reassigning ? 'Reassigning...' : 'Save Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Modal */}
      {deleteId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem'
        }}>
          <div className="clay-card" style={{ padding: '2rem', maxWidth: '400px', width: '100%', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '12px' }}>
                <Trash2 size={24} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Admin Delete Complaint</h3>
                <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Remove complaint & all related audit history permanently.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDeleteComplaint} className="btn btn-primary" style={{ flex: 1, background: '#dc2626' }} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
