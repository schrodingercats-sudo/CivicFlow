import React from 'react';
import { ArrowDown, Minus, ArrowUp, AlertTriangle } from 'lucide-react';

const priorityConfig = {
  low: { label: 'Low', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', Icon: ArrowDown },
  medium: { label: 'Medium', bg: '#fef3c7', color: '#92400e', border: '#fde68a', Icon: Minus },
  high: { label: 'High', bg: '#ffedd5', color: '#9a3412', border: '#fed7aa', Icon: ArrowUp },
  critical: { label: 'Critical', bg: '#fee2e2', color: '#991b1b', border: '#fecaca', Icon: AlertTriangle }
};

export const PriorityBadge = ({ priority }) => {
  const config = priorityConfig[priority] || priorityConfig.medium;
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
