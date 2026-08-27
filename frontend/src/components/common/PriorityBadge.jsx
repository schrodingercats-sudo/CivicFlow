import React from 'react';
import { ArrowDown, Minus, ArrowUp, Flame, AlertTriangle } from 'lucide-react';

const priorityConfig = {
  low: { label: 'Low', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', Icon: ArrowDown },
  medium: { label: 'Medium', bg: '#fef3c7', color: '#92400e', border: '#fde68a', Icon: Minus },
  high: { label: 'High', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa', Icon: ArrowUp },
  critical: { label: 'Critical', bg: '#fee2e2', color: '#991b1b', border: '#fecaca', Icon: Flame }
};

export const PriorityBadge = ({ priority, size = 'default' }) => {
  const config = priorityConfig[priority] || priorityConfig.medium;
  const IconComponent = config.Icon;
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
        strokeWidth={priority === 'critical' ? 2.5 : 2.2} 
        style={{ flexShrink: 0 }} 
      />
      <span>{config.label}</span>
    </span>
  );
};
