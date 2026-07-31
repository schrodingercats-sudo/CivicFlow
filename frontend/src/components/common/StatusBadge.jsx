import React from 'react';
import { Clock, CheckCircle2, RefreshCw, XCircle, AlertCircle, UserCheck, Play } from 'lucide-react';

const statusConfig = {
  submitted: { label: 'Submitted', bg: '#f1f5f9', color: '#334155', border: '#cbd5e1', Icon: Clock },
  under_review: { label: 'Under Review', bg: '#fef3c7', color: '#92400e', border: '#fde68a', Icon: Clock },
  assigned: { label: 'Assigned', bg: '#e0f2fe', color: '#075985', border: '#bae6fd', Icon: UserCheck },
  in_progress: { label: 'In Progress', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', Icon: Play },
  resolved: { label: 'Resolved', bg: '#dcfce7', color: '#166534', border: '#bbf7d0', Icon: CheckCircle2 },
  closed: { label: 'Closed', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', Icon: XCircle },
  withdrawn: { label: 'Withdrawn', bg: '#fef3c7', color: '#92400e', border: '#fde68a', Icon: XCircle },
  rejected: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b', border: '#fecaca', Icon: AlertCircle }
};

export const StatusBadge = ({ status }) => {
  const config = statusConfig[status] || statusConfig.submitted;
  const IconComponent = config.Icon;

  return (
    <span
      className="badge"
      style={{
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        whiteSpace: 'nowrap',
        lineHeight: 1.2
      }}
    >
      <IconComponent size={12} style={{ flexShrink: 0 }} />
      <span>{config.label}</span>
    </span>
  );
};
