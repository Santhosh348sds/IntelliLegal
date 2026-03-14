import React from 'react';

interface StatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  Approved: {
    label: 'Approved',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '1.5px solid #16a34a',
    icon: '✓',
  },
  Reprogress: {
    label: 'Awaiting Resubmission',
    color: '#d97706',
    bg: '#fffbeb',
    border: '1.5px solid #d97706',
    icon: '☆',
  },
  'Under Review': {
    label: 'Under Review',
    color: '#d97706',
    bg: '#fffbeb',
    border: '1.5px solid #d97706',
    icon: '⏰',
  },
  'Re-Submit': {
    label: 'Re-Submitted',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '1.5px solid #2563eb',
    icon: '↩',
  },
};

interface Props {
  status: string;
}

const StatusBadge: React.FC<Props> = ({ status }) => {
  const cfg: StatusConfig = STATUS_MAP[status] ?? {
    label: status,
    color: '#6b7280',
    bg: '#f9fafb',
    border: '1.5px solid #9ca3af',
    icon: '•',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 14px',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 500,
        color: cfg.color,
        background: cfg.bg,
        border: cfg.border,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 12 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};

export default StatusBadge;
