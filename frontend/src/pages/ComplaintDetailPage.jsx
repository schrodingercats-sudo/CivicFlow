import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { complaintService } from '../services/complaint.service';
import { useAuth } from '../hooks/useAuth';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { AppLayout } from '../components/layout/AppLayout';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Building2,
  User,
  Star,
  Clock,
  Sparkles,
  X,
  Check,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  Phone,
  Mail
} from 'lucide-react';

export const ComplaintDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [ratingScore, setRatingScore] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetchComplaint();
  }, [id]);

  const fetchComplaint = async () => {
    setLoading(true);
    try {
      const data = await complaintService.getComplaintById(id);
      const c = data?.complaint || data;
      if (!c.timeline) c.timeline = c.cf_complaint_updates || [];
      if (!c.rating) c.rating = c.cf_ratings || null;
      if (!c.citizen) c.citizen = c.cf_users || null;
      if (!c.worker_updates) c.worker_updates = c.cf_worker_updates || [];
      setComplaint(c);
    } catch (err) {
      setError(err.message || 'Failed to load complaint details');
    } finally {
      setLoading(false);
    }
  };

  const handleRateSubmit = async (e) => {
    e.preventDefault();
    setSubmittingRating(true);
    try {
      await complaintService.rateComplaint(id, { rating_score: ratingScore, feedback });
      await fetchComplaint();
    } catch (err) {
      alert(err.message || 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawing(true);
    try {
      await complaintService.withdrawComplaint(id, withdrawReason);
      setShowWithdrawModal(false);
      await fetchComplaint();
    } catch (err) {
      alert(err.message || 'Failed to withdraw complaint');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <AppLayout headerTitle="Incident Details">
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <div>Loading municipal complaint records...</div>
        </div>
      </AppLayout>
    );
  }

  if (error || !complaint) {
    return (
      <AppLayout headerTitle="Incident Not Found">
        <div className="civic-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px', margin: '2rem auto' }}>
          <AlertTriangle size={48} color="#dc2626" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            Complaint Not Found
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            {error || "The requested issue could not be found or you do not have permission to view it."}
          </p>
          <button onClick={() => navigate(-1)} className="btn btn-primary">
            <ArrowLeft size={16} /> Return Back
          </button>
        </div>
      </AppLayout>
    );
  }

  const isCitizenOwner = user?.id === complaint.citizen_id || user?.id === complaint.user_id;
  const canWithdraw = (user?.role === 'citizen' && isCitizenOwner && ['submitted', 'assigned', 'in_progress'].includes(complaint.status));

  return (
    <AppLayout
      headerTitle={`Issue #${complaint.id?.slice(0, 8) || 'Record'}`}
      headerSubtitle="Detailed civic inspection, timeline history & departmental actions"
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          {canWithdraw && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="btn btn-danger"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
            >
              <X size={14} strokeWidth={2.8} /> Withdraw Application
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '1.5rem' }}>
          {/* Left Column: Details, Proof, AI Summary & Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Main Issue Card */}
            <div className="civic-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                <StatusBadge status={complaint.status} />
                <PriorityBadge priority={complaint.priority} />
              </div>

              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', lineHeight: 1.3 }}>
                {complaint.title}
              </h1>

              <p style={{ color: '#334155', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.25rem', whiteSpace: 'pre-wrap' }}>
                {complaint.description}
              </p>

              {/* Photos */}
              {complaint.image_url && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Citizen Proof Media
                  </div>
                  <ComplaintImage
                    src={complaint.image_url}
                    alt={complaint.title}
                    category={complaint.category}
                    style={{ width: '100%', maxHeight: '320px', borderRadius: '10px' }}
                  />
                </div>
              )}

              {complaint.geo_image_url && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Check size={13} strokeWidth={2.8} /> GeoCam Stamp Verified
                  </div>
                  <img
                    src={complaint.geo_image_url}
                    alt="GeoCam Verified"
                    style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                  />
                </div>
              )}

              {/* AI Summary */}
              {complaint.ai_summary && (
                <div style={{ background: '#eff6ff', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#1d4ed8', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <Sparkles size={16} /> AI Triage Summary
                  </div>
                  <p style={{ color: '#1e40af', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {complaint.ai_summary}
                  </p>
                </div>
              )}
            </div>

            {/* Resolution Progress Timeline */}
            <div className="civic-card" style={{ padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Clock size={18} color="#2563eb" /> Resolution Progress Timeline
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', paddingLeft: '1.25rem' }}>
                <div style={{ position: 'absolute', left: '6px', top: '8px', bottom: '8px', width: '2px', background: '#cbd5e1' }} />

                {complaint.timeline && complaint.timeline.length > 0 ? (
                  complaint.timeline.map((event, index) => (
                    <div key={event.id || index} style={{ position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-1.25rem',
                        top: '4px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: index === complaint.timeline.length - 1 ? '#2563eb' : '#94a3b8',
                        border: '2px solid #ffffff'
                      }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                          Status: <span style={{ color: '#2563eb', textTransform: 'capitalize' }}>{event.new_status?.replace('_', ' ') || 'Update'}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>

                      {event.remarks && (
                        <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#334155', marginTop: '0.35rem' }}>
                          "{event.remarks}"
                        </div>
                      )}

                      {event.proof_image_url && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '0.2rem' }}>Officer Proof:</div>
                          <ComplaintImage src={event.proof_image_url} alt="Proof" category={complaint.category} style={{ width: '140px', height: '90px' }} />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    Issue registered in municipal system. Awaiting field dispatch.
                  </div>
                )}
              </div>
            </div>

            {/* Field Worker On-Site Activity & History */}
            <div className="civic-card" style={{ padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Wrench size={18} color="#2563eb" /> Field Worker Activity & Dispatch
              </h2>

              {complaint.worker_updates && complaint.worker_updates.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {complaint.worker_updates.map((update, idx) => (
                    <div key={update.id || idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase',
                            background: update.update_type === 'completed' ? '#dcfce7' : update.update_type === 'in_progress' ? '#eff6ff' : '#fef3c7',
                            color: update.update_type === 'completed' ? '#166534' : update.update_type === 'in_progress' ? '#1d4ed8' : '#92400e'
                          }}>
                            {update.update_type.replace('_', ' ')}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                            {update.worker?.name || 'Field Worker'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {new Date(update.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '0.3rem' }}>
                        "{update.remarks}"
                      </div>

                      {(update.geo_image_url || update.proof_image_url) && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <img
                            src={update.geo_image_url || update.proof_image_url}
                            alt="Field Proof"
                            style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                          <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <ShieldCheck size={13} /> GeoCam Verified Field Photo
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.85rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px' }}>
                  {complaint.assigned_worker_id
                    ? 'Worker assigned — awaiting first on-site check-in.'
                    : 'No field worker assigned yet. Officer will dispatch field staff upon triage.'}
                </div>
              )}
            </div>

            {/* Rating Section */}
            {(complaint.status === 'resolved' || complaint.status === 'closed') && (
              <div className="civic-card" style={{ padding: '1.75rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Star size={18} color="#f59e0b" fill="#f59e0b" /> Resolution Rating & Citizen Feedback
                </h2>

                {complaint.rating ? (
                  <div style={{ background: '#f8fafc', padding: '1.15rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: '0.2rem', color: '#f59e0b', marginBottom: '0.35rem' }}>
                      {[...Array(complaint.rating.rating_score || 5)].map((_, i) => (
                        <Star key={i} size={16} fill="#f59e0b" />
                      ))}
                    </div>
                    <p style={{ color: '#334155', fontSize: '0.88rem' }}>"{complaint.rating.feedback}"</p>
                  </div>
                ) : (
                  user?.role === 'citizen' && (
                    <form onSubmit={handleRateSubmit}>
                      <div className="form-group">
                        <label className="form-label">Score Municipal Resolution (1 to 5 Stars)</label>
                        <div style={{ display: 'flex', gap: '0.4rem', margin: '0.4rem 0' }}>
                          {[1, 2, 3, 4, 5].map(score => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => setRatingScore(score)}
                              style={{
                                background: ratingScore >= score ? '#0f172a' : '#ffffff',
                                border: `1px solid ${ratingScore >= score ? '#0f172a' : '#cbd5e1'}`,
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                color: ratingScore >= score ? '#ffffff' : '#475569',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <Star size={13} fill={ratingScore >= score ? '#ffffff' : 'none'} color={ratingScore >= score ? '#ffffff' : '#94a3b8'} />
                              <span>{score}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Your Feedback</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          placeholder="How satisfied are you with the resolution?"
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          required
                        />
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={submittingRating}>
                        {submittingRating ? 'Submitting...' : 'Submit Resolution Feedback'}
                      </button>
                    </form>
                  )
                )}
              </div>
            )}
          </div>

          {/* Right Column: Meta Info & GIS Map */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="civic-card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', fontWeight: 800, marginBottom: '1rem' }}>
                Incident Details
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Assigned Department</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                    <Building2 size={15} color="#2563eb" /> {complaint.cf_departments?.name || 'General Municipal'}
                  </div>
                </div>

                {complaint.worker && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Assigned Field Worker</div>
                    <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                      <Wrench size={15} color="#2563eb" /> {complaint.worker.name}
                    </div>
                    {complaint.worker.phone && (
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Phone size={12} /> <a href={`tel:${complaint.worker.phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{complaint.worker.phone}</a>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Reported Location</div>
                  <div style={{ color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '0.35rem', marginTop: '2px' }}>
                    <MapPin size={15} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      {complaint.address || 'Central District'}
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>
                        GPS: ({complaint.latitude}, {complaint.longitude})
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Reported Citizen</div>
                  <div style={{ color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                    <User size={15} /> {complaint.citizen?.name || 'Registered Citizen'}
                  </div>
                  {complaint.citizen?.email && (
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Mail size={12} /> {complaint.citizen.email}
                    </div>
                  )}
                  {complaint.citizen?.phone && (
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Phone size={12} /> {complaint.citizen.phone}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Submission Date</div>
                  <div style={{ color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                    <Calendar size={15} /> {new Date(complaint.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* GIS Map */}
            <div className="civic-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', marginBottom: '0.75rem' }}>
                <MapPin size={16} color="#2563eb" /> Incident Spot Map
              </div>
              <ComplaintMap
                latitude={complaint.latitude}
                longitude={complaint.longitude}
                address={complaint.address}
                title={complaint.title}
                category={complaint.category}
                height="240px"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
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
              Are you sure you want to withdraw this issue? This action will close the complaint.
            </p>

            <form onSubmit={handleWithdraw}>
              <div className="form-group">
                <label className="form-label">Reason for Withdrawal (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Fixed independently"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowWithdrawModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
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
    </AppLayout>
  );
};
