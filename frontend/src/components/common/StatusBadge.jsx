import React from 'react';
import { Clock, Check, Play, X, AlertTriangle, UserCheck } from 'lucide-react';

const statusConfig = {
  submitted: { label: 'Submitted', bg: '#f1f5f9', color: '#334155', border: '#cbd5e1', Icon: Clock },
  under_review: { label: 'Under Review', bg: '#fef3c7', color: '#92400e', border: '#fde68a', Icon: Clock },
  assigned: { label: 'Assigned', bg: '#e0f2fe', color: '#075985', border: '#bae6fd', Icon: UserCheck },
  in_progress: { label: 'In Progress', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', Icon: Play },
  resolved: { label: 'Resolved', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', Icon: Check },
  closed: { label: 'Closed', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', Icon: X },
  withdrawn: { label: 'Withdrawn', bg: '#fef3c7', color: '#92400e', border: '#fde68a', Icon: X },
  rejected: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b', border: '#fecaca', Icon: AlertTriangle }
};

export const StatusBadge = ({ status, size = 'default' }) => {
  const config = statusConfig[status] || statusConfig.submitted;
  const IconComponent = config.Icon;
  const isResolvedOrClosed = status === 'resolved' || status === 'closed' || status === 'withdrawn';

  const isSmall = size === 'sm';

  return (
    <span
      className="badge"
      style={{
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        padding: isSmall ? '0.2rem 0.55rem' : '0.28rem 0.75rem',
        fontSize: isSmall ? '0.72rem' : '0.76rem',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        borderRadius: '9999px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
      }}
    >
      <IconComponent 
        size={isSmall ? 13 : 15} 
        strokeWidth={isResolvedOrClosed ? 2.8 : 2.2} 
        style={{ flexShrink: 0 }} 
      />
      <span>{config.label}</span>
    </span>
  );
};
