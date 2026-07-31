import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { complaintService } from '../services/complaint.service';
import { useAuth } from '../hooks/useAuth';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { ComplaintImage } from '../components/common/ComplaintImage';
import { ComplaintMap } from '../components/common/ComplaintMap';
import { ArrowLeft, MapPin, Calendar, Building2, User, Star, Clock, Sparkles, XCircle } from 'lucide-react';

export const ComplaintDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
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
      setComplaint(data);
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

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading complaint details...</div>;
  if (error || !complaint) return <div style={{ color: '#0f172a', textAlign: 'center', padding: '4rem' }}>{error || 'Complaint not found'}</div>;

  const canWithdraw = (user.role === 'citizen' || user.role === 'admin') && complaint.status !== 'closed' && complaint.status !== 'resolved' && complaint.status !== 'withdrawn' && complaint.status !== 'rejected';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="responsive-header" style={{ marginBottom: '1.5rem' }}>
        <Link to="/citizen" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back to My Complaints
        </Link>

        {canWithdraw && (
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem', color: '#991b1b', borderColor: '#fecaca' }}
          >
            <XCircle size={16} /> Withdraw Application
          </button>
        )}
      </div>

      <div className="grid-2-1">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="clay-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <StatusBadge status={complaint.status} />
              <PriorityBadge priority={complaint.priority} />
            </div>

            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '1rem', color: '#0f172a' }}>
              {complaint.title}
            </h1>

            <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>
              {complaint.description}
            </p>

            {complaint.image_url && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>Submitted Proof Media</div>
                <ComplaintImage
                  src={complaint.image_url}
                  alt={complaint.title}
                  category={complaint.category}
                  style={{ width: '100%', maxHeight: '380px' }}
                />
              </div>
            )}

            {complaint.ai_summary && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '1.25rem',
                borderRadius: '12px',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <Sparkles size={18} color="#2563eb" /> AI Executive Triage Summary
                </div>
                <p style={{ color: '#334155', fontSize: '0.875rem' }}>{complaint.ai_summary}</p>
              </div>
            )}
          </div>

          <div className="clay-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="#0f172a" /> Resolution Progress Timeline
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', paddingLeft: '1.5rem' }}>
              <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: '#cbd5e1' }} />

              {complaint.timeline.map((event, index) => (
                <div key={event.id} style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-1.5rem',
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: index === complaint.timeline.length - 1 ? '#0f172a' : '#cbd5e1',
                    border: '3px solid #ffffff'
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                      Status changed to <span style={{ color: '#2563eb', textTransform: 'capitalize' }}>{event.new_status.replace('_', ' ')}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>

                  {event.remarks && (
                    <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.875rem', color: '#334155', marginTop: '0.35rem' }}>
                      "{event.remarks}"
                    </div>
                  )}

                  {event.proof_image_url && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Officer Resolution Proof:</div>
                      <ComplaintImage src={event.proof_image_url} alt="Proof" category={complaint.category} style={{ width: '160px', height: '100px' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {(complaint.status === 'resolved' || complaint.status === 'closed') && (
            <div className="clay-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Star size={20} color="#0f172a" /> Resolution Rating & Feedback
              </h3>

              {complaint.rating ? (
                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
                    {[...Array(complaint.rating.rating_score)].map((_, i) => (
                      <Star key={i} size={18} fill="#f59e0b" />
                    ))}
                  </div>
                  <p style={{ color: '#334155', fontSize: '0.9rem' }}>"{complaint.rating.feedback}"</p>
                </div>
              ) : (
                user.role === 'citizen' && (
                  <form onSubmit={handleRateSubmit}>
                    <div className="form-group">
                      <label className="form-label">Score Resolution (1 to 5 Stars)</label>
                      <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0' }}>
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setRatingScore(score)}
                            style={{
                              background: ratingScore >= score ? '#0f172a' : '#ffffff',
                              border: `1px solid ${ratingScore >= score ? '#0f172a' : '#cbd5e1'}`,
                              padding: '0.5rem 1rem',
                              borderRadius: '8px',
                              color: ratingScore >= score ? '#ffffff' : '#475569',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            ★ {score}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Your Feedback</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Was the issue resolved satisfactorily?"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        required
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={submittingRating}>
                      Submit Rating
                    </button>
                  </form>
                )
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="clay-card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '1.25rem', fontWeight: 800 }}>
              Incident Meta
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', fontSize: '0.875rem' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Assigned Department</div>
                <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                  <Building2 size={16} /> {complaint.cf_departments?.name || 'Unassigned'}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Reported Location</div>
                <div style={{ color: '#0f172a', display: 'flex', alignItems: 'flex-start', gap: '0.35rem', marginTop: '0.15rem' }}>
                  <MapPin size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    {complaint.address}
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      ({complaint.latitude}, {complaint.longitude})
                    </div>
                  </div>
                </div>
                {/* Live Leaflet Location Map */}
                <div style={{ marginTop: '0.85rem' }}>
                  <ComplaintMap
                    latitude={complaint.latitude}
                    longitude={complaint.longitude}
                    address={complaint.address}
                    title={complaint.title}
                    category={complaint.category}
                    height="220px"
                  />
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Reported By</div>
                <div style={{ color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                  <User size={16} /> {complaint.citizen?.name}
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Submission Timestamp</div>
                <div style={{ color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                  <Calendar size={16} /> {new Date(complaint.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showWithdrawModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem'
        }}>
          <div className="clay-card" style={{ padding: '2rem', maxWidth: '440px', width: '100%', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
              Withdraw Complaint Application
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
                  placeholder="e.g. Issue resolved independently or submitted by mistake"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowWithdrawModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, background: '#991b1b' }} disabled={withdrawing}>
                  {withdrawing ? 'Withdrawing...' : 'Confirm Withdraw'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
