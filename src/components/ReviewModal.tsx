import React from 'react';
import { ActionType, DriveItem, FormState } from '../types';

// ── Config per action ─────────────────────────────────────────────────────────

interface ActionConfig {
  badge: string;
  badgeBg: string;
  emailLabel: string;
  commentLabel: string;
  commentPlaceholder: string;
  submitLabel: string;
  submitBg: string;
}

const ACTION_CONFIG: Record<ActionType, ActionConfig> = {
  Approved: {
    badge:              'APPROVE',
    badgeBg:            '#27ae60',
    emailLabel:         'Reviewer Email',
    commentLabel:       'Comments (optional)',
    commentPlaceholder: 'Any additional comments...',
    submitLabel:        'Confirm Approve',
    submitBg:           '#27ae60',
  },
  Reprogress: {
    badge:              'REPROGRESS',
    badgeBg:            '#e67e22',
    emailLabel:         'Reviewer Email',
    commentLabel:       'Reprogress Reason *',
    commentPlaceholder: 'Describe what needs to be corrected...',
    submitLabel:        'Send for Reprogress',
    submitBg:           '#e67e22',
  },
  'Re-Submit': {
    badge:              'RESUBMIT',
    badgeBg:            '#2980b9',
    emailLabel:         'Author Email',
    commentLabel:       'Resubmission Notes (optional)',
    commentPlaceholder: 'Describe what was updated...',
    submitLabel:        'Confirm Resubmit',
    submitBg:           '#2980b9',
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  action: ActionType;
  doc: DriveItem;
  form: FormState;
  successMsg: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFieldChange: (patch: Partial<FormState>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ReviewModal: React.FC<Props> = ({
  action, doc, form, successMsg, onClose, onSubmit, onFieldChange,
}) => {
  const cfg = ACTION_CONFIG[action];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={styles.header}>
          <span style={{ ...styles.badge, background: cfg.badgeBg }}>{cfg.badge}</span>
          <h2 style={styles.title}>{doc.name}</h2>
          <p style={styles.subtitle}>Document ID: {doc.Document_ID || '—'}</p>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit}>

          {/* Document ID */}
          <div style={styles.field}>
            <label style={styles.label}>Document ID *</label>
            <input
              type="text"
              style={styles.input}
              placeholder="Enter Document ID"
              value={form.documentId}
              onChange={(e) => onFieldChange({ documentId: e.target.value })}
              disabled={form.submitting}
            />
          </div>

          {/* Email — read-only from MSAL account */}
          <div style={styles.field}>
            <label style={styles.label}>{cfg.emailLabel}</label>
            <input
              type="email"
              style={{ ...styles.input, ...styles.readOnlyInput }}
              value={form.email}
              readOnly
              title="Auto-filled from your signed-in Microsoft account"
            />
            <span style={styles.inputHint}>Auto-filled from your Microsoft account</span>
          </div>

          {/* Comments */}
          <div style={styles.field}>
            <label style={styles.label}>{cfg.commentLabel}</label>
            <textarea
              style={styles.textarea}
              rows={4}
              placeholder={cfg.commentPlaceholder}
              value={form.comments}
              onChange={(e) => onFieldChange({ comments: e.target.value })}
              disabled={form.submitting}
            />
          </div>

          {/* Feedback messages */}
          {form.error  && <p style={styles.errorMsg}>{form.error}</p>}
          {successMsg  && <p style={styles.successMsg}>{successMsg}</p>}

          {/* Footer buttons */}
          <div style={styles.footer}>
            <button
              type="button"
              style={styles.cancelBtn}
              onClick={onClose}
              disabled={form.submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ ...styles.submitBtn, background: cfg.submitBg }}
              disabled={form.submitting}
            >
              {form.submitting ? 'Submitting…' : cfg.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 10, padding: '32px',
    width: 480, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  header:   { marginBottom: 24 },
  badge: {
    display: 'inline-block', color: '#fff', fontSize: 11, fontWeight: 700,
    padding: '3px 10px', borderRadius: 12, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  title:    { fontSize: 18, margin: '0 0 4px', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#888', margin: 0 },
  field:    { marginBottom: 18 },
  label:    { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 },
  input: {
    width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1px solid #ccc', borderRadius: 6, boxSizing: 'border-box', outline: 'none',
  },
  readOnlyInput: { backgroundColor: '#f5f5f5', color: '#555', cursor: 'default' },
  inputHint:     { display: 'block', fontSize: 11, color: '#888', marginTop: 4 },
  textarea: {
    width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1px solid #ccc', borderRadius: 6,
    boxSizing: 'border-box', resize: 'vertical', outline: 'none',
  },
  errorMsg: {
    color: '#c0392b', fontSize: 13, backgroundColor: '#fdecea',
    padding: '8px 12px', borderRadius: 5, marginBottom: 12,
  },
  successMsg: {
    color: '#1e7e34', fontSize: 13, backgroundColor: '#d4edda',
    padding: '8px 12px', borderRadius: 5, marginBottom: 12,
  },
  footer:    { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn: {
    padding: '8px 20px', fontSize: 14, border: '1px solid #ccc',
    borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#333',
  },
  submitBtn: {
    padding: '8px 20px', fontSize: 14, border: 'none',
    borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600,
  },
};

export default ReviewModal;
