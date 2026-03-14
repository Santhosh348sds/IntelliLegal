import React, { useEffect, useState } from 'react';
import { LdraRequest, WorkflowHistoryItem, ApproverComment } from '../types';
import { fetchRequest, fetchWorkflowHistory } from '../services/sharepointService';

// ── Types ─────────────────────────────────────────────────────────────────────

type StageState = 'done' | 'current' | 'paused' | 'pending' | 'rejected';

interface TimelineStage {
  key: string;
  label: string;
  state: StageState;
  date?: string;
}

interface Props {
  requestTitle: string;
  onBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Derive initials from email: "john.smith@co.com" → "JS" */
function emailInitials(email: string): string {
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Derive display name from email */
function emailToName(email: string): string {
  const name = email.split('@')[0] ?? '';
  return name
    .split(/[._-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Timeline logic ────────────────────────────────────────────────────────────

function getTimelineStages(status: string, history: WorkflowHistoryItem[]): TimelineStage[] {
  let states: StageState[];

  switch (status) {
    case 'New':
      states = ['done', 'pending', 'pending', 'pending']; break;
    case 'Pending':
      states = ['done', 'done', 'current', 'pending']; break;
    case 'Re-Progress':
    case 'Reprogress':
      states = ['done', 'paused', 'pending', 'pending']; break;
    case 'Resubmitted':
    case 'Re-Submit':
      states = ['done', 'done', 'current', 'pending']; break;
    case 'Approved':
      states = ['done', 'done', 'done', 'done']; break;
    case 'Rejected':
      states = ['done', 'done', 'done', 'rejected']; break;
    default:
      states = ['done', 'pending', 'pending', 'pending'];
  }

  // Pull dates from workflow history
  const submittedDate = history[0]?.actionDate ?? '';
  const pendingDate   = history.find((h) => h.toStatus === 'Pending')?.actionDate ?? '';
  const feedbackDate  = history.find((h) => ['Reprogress', 'Re-Progress', 'Resubmitted', 'Re-Submit'].includes(h.toStatus))?.actionDate ?? '';
  const doneDate      = history.find((h) => ['Approved', 'Rejected'].includes(h.toStatus))?.actionDate ?? '';

  return [
    { key: 'submitted',  label: 'Submitted',    state: states[0], date: submittedDate },
    { key: 'underReview',label: 'Under Review',  state: states[1], date: pendingDate },
    { key: 'feedback',   label: 'Feedback',      state: states[2], date: feedbackDate },
    { key: 'completed',  label: 'Completed',     state: states[3], date: doneDate },
  ];
}

// ── Stage circle ──────────────────────────────────────────────────────────────

const STAGE_CFG: Record<StageState, { bg: string; color: string; border?: string; icon: string; shadow?: string }> = {
  done:     { bg: '#16a34a', color: '#fff',     icon: '✓' },
  current:  { bg: '#fff',    color: '#0891b2',  icon: '●', border: '3px solid #0891b2', shadow: '0 0 0 5px rgba(8,145,178,0.15)' },
  paused:   { bg: '#d97706', color: '#fff',     icon: '⏸' },
  pending:  { bg: '#fff',    color: '#9ca3af',  icon: '○', border: '2px solid #e5e7eb' },
  rejected: { bg: '#dc2626', color: '#fff',     icon: '✕' },
};

function StageCircle({ state }: { state: StageState }) {
  const c = STAGE_CFG[state];
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
      background: c.bg, color: c.color,
      border: c.border ?? 'none',
      boxShadow: c.shadow,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 700, position: 'relative', zIndex: 1,
    }}>
      {c.icon}
    </div>
  );
}

// ── Status badge for WorkflowHistory ToStatus ─────────────────────────────────

const WF_STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  Approved:      { label: 'Approved',           color: '#16a34a', bg: '#f0fdf4', border: '1.5px solid #16a34a' },
  Rejected:      { label: 'Rejected',           color: '#dc2626', bg: '#fef2f2', border: '1.5px solid #dc2626' },
  Pending:       { label: 'Under Review',       color: '#0891b2', bg: '#ecfeff', border: '1.5px solid #0891b2' },
  Reprogress:    { label: 'Revision Required',  color: '#d97706', bg: '#fffbeb', border: '1.5px solid #d97706' },
  'Re-Progress': { label: 'Revision Required',  color: '#d97706', bg: '#fffbeb', border: '1.5px solid #d97706' },
  Resubmitted:   { label: 'Resubmitted',        color: '#7c3aed', bg: '#f5f3ff', border: '1.5px solid #7c3aed' },
  'Re-Submit':   { label: 'Resubmitted',        color: '#7c3aed', bg: '#f5f3ff', border: '1.5px solid #7c3aed' },
  New:           { label: 'Submitted',          color: '#6b7280', bg: '#f9fafb', border: '1.5px solid #9ca3af' },
  // Values that come directly from ApproverComments.status
  Approve:       { label: 'Approved',           color: '#16a34a', bg: '#f0fdf4', border: '1.5px solid #16a34a' },
  Reject:        { label: 'Rejected',           color: '#dc2626', bg: '#fef2f2', border: '1.5px solid #dc2626' },
};

function WfBadge({ status }: { status: string }) {
  const c = WF_STATUS_CFG[status] ?? { label: status, color: '#6b7280', bg: '#f9fafb', border: '1.5px solid #9ca3af' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 12px', borderRadius: 20,
      fontSize: 12, fontWeight: 600,
      color: c.color, background: c.bg, border: c.border,
    }}>
      {c.label}
    </span>
  );
}

// ── Request status badge (for the header) ─────────────────────────────────────

const REQ_STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  New:         { label: 'Active Request',   color: '#0891b2', bg: '#ecfeff', border: '1.5px solid #0891b2' },
  Pending:     { label: 'Under Review',     color: '#d97706', bg: '#fffbeb', border: '1.5px solid #d97706' },
  Approved:    { label: 'Approved',         color: '#16a34a', bg: '#f0fdf4', border: '1.5px solid #16a34a' },
  Rejected:    { label: 'Rejected',         color: '#dc2626', bg: '#fef2f2', border: '1.5px solid #dc2626' },
  Reprogress:  { label: 'Awaiting Revision',color: '#d97706', bg: '#fffbeb', border: '1.5px solid #d97706' },
  'Re-Progress': { label: 'Awaiting Revision', color: '#d97706', bg: '#fffbeb', border: '1.5px solid #d97706' },
  Resubmitted: { label: 'Resubmitted',      color: '#7c3aed', bg: '#f5f3ff', border: '1.5px solid #7c3aed' },
  'Re-Submit': { label: 'Resubmitted',      color: '#7c3aed', bg: '#f5f3ff', border: '1.5px solid #7c3aed' },
};

// ── Main component ────────────────────────────────────────────────────────────

/** Extract a human-readable filename from a URL */
function filenameFromUrl(url: string): string {
  if (!url) return 'Document';
  const last = url.split('/').pop() ?? '';
  const decoded = decodeURIComponent(last);
  // Strip timestamp prefix like "1741234567890_filename.pdf"
  return decoded.replace(/^\d+_/, '') || 'Document';
}

const RequestDetail: React.FC<Props> = ({ requestTitle, onBack }) => {
  const [request,  setRequest]  = useState<LdraRequest | null>(null);
  const [history,  setHistory]  = useState<WorkflowHistoryItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetchRequest(requestTitle),
      fetchWorkflowHistory(requestTitle),
    ])
      .then(([req, hist]) => {
        setRequest(req);
        setHistory(hist);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [requestTitle]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const status = request?.status ?? 'New';
  const stages = request ? getTimelineStages(status, history) : [];
  const doneCount = stages.filter((s) => s.state === 'done').length;
  // Green line width: 0 stages done beyond first = 0%, all 4 = 100%
  const lineGreenPct = Math.max(0, ((doneCount - 1) / 3) * 100);

  const reqStatusCfg = REQ_STATUS_CFG[status] ?? REQ_STATUS_CFG['New'];
  // reviewerEmail / reviewerName are resolved server-side from AssignedApprover,
  // AssignedApproverEmail, and the ApproverComments JSON (most up-to-date).
  const approverEmail = request?.reviewerEmail || request?.assignedApproverEmail || '';
  const approverName  = request?.reviewerName  || '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* ── Navbar ── */}
      <header style={S.header}>
        <div style={S.logoRow}>
          <svg width="36" height="36" viewBox="0 0 44 44" fill="none">
            <path d="M22 2L4 10v12c0 10.5 7.7 20.3 18 22.6C32.3 42.3 40 32.5 40 22V10L22 2z"
              fill="url(#sg3)" />
            <defs>
              <linearGradient id="sg3" x1="4" y1="2" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2d9cdb" />
                <stop offset="100%" stopColor="#1a6b5a" />
              </linearGradient>
            </defs>
            <path d="M15 22l5 5 9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={S.brandText}>Intelli<span style={S.brandAccent}>Legal</span></span>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={S.main}>

        {/* Back row */}
        <button style={S.backBtn} onClick={onBack}>
          ← My Dashboard
        </button>

        {loading && <p style={S.stateText}>Loading request details…</p>}
        {error   && <div style={S.errorBanner}>Error: {error}</div>}

        {!loading && !error && request && (
          <div style={S.grid}>

            {/* ── Left column ── */}
            <div style={S.leftCol}>

              {/* Review card */}
              <div style={S.card}>
                {/* Title + badge */}
                <div style={S.reviewTitleRow}>
                  <h2 style={S.reviewTitle}>
                    Review — {request.customerName} {request.documentType}
                  </h2>
                  <span style={{
                    ...S.statusBadge,
                    color: reqStatusCfg.color,
                    background: reqStatusCfg.bg,
                    border: reqStatusCfg.border,
                  }}>
                    {reqStatusCfg.label}
                  </span>
                </div>

                {/* Timeline */}
                <div style={S.timelineWrap}>
                  {/* Background line */}
                  <div style={S.bgLine} />
                  {/* Green progress line */}
                  <div style={{ ...S.greenLine, width: `${lineGreenPct * 0.75}%` }} />

                  {stages.map((stage, idx) => (
                    <div key={stage.key} style={S.stageCol}>
                      <StageCircle state={stage.state} />
                      <span style={{
                        ...S.stageLabel,
                        color: stage.state === 'current' ? '#0891b2'
                          : stage.state === 'done' ? '#374151'
                          : stage.state === 'rejected' ? '#dc2626'
                          : stage.state === 'paused' ? '#d97706'
                          : '#9ca3af',
                        fontWeight: stage.state === 'current' ? 700 : 500,
                      }}>
                        {stage.label}
                      </span>
                      {stage.date && (
                        <span style={S.stageDate}>{formatDate(stage.date)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submitted Documents */}
              <div style={{ ...S.card, marginTop: 16 }}>
                <h3 style={S.sectionTitle}>Submitted Documents (1)</h3>

                <div style={S.docRow}>
                  {/* File icon */}
                  <div style={S.fileIcon}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                        stroke="#7c3aed" strokeWidth="2" fill="#f5f3ff" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#7c3aed" strokeWidth="1.5"
                        strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* File info */}
                  <div style={S.fileInfo}>
                    <a
                      href={request.documentUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={S.fileLink}
                    >
                      {filenameFromUrl(request.documentUrl) || request.title}
                    </a>
                    <span style={S.fileMeta}>
                      {formatDate(request.lastStatusChange)}
                      {request.versionNumber > 1 && ` · v${request.versionNumber}`}
                    </span>
                  </div>

                  {/* Doc status badge */}
                  <WfBadge status={status} />

                  {/* Actions */}
                  <div style={S.docActions}>
                    {request.documentUrl && (
                    <a
                      href={request.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={S.viewLink}
                    >
                      View Document
                    </a>
                    )}
                    {(status === 'Reprogress' || status === 'Re-Progress') && (
                      <span style={S.actionDot}> · </span>
                    )}
                    {(status === 'Reprogress' || status === 'Re-Progress') && (
                      <span style={S.uploadLink}>Upload Revision</span>
                    )}
                  </div>
                </div>

                {/* Request metadata */}
                {(request.priority || request.opportunityValue) && (
                  <div style={S.metaRow}>
                    {request.priority && (
                      <span style={S.metaPill}>{request.priority} Priority</span>
                    )}
                    {request.opportunityValue > 0 && (
                      <span style={S.metaPill}>
                        ${request.opportunityValue.toLocaleString()} Value
                      </span>
                    )}
                    {request.remarks && (
                      <span style={{ ...S.metaPill, background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {request.remarks}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column ── */}
            <div style={S.rightCol}>

              {/* Reviewer card */}
              <div style={S.card}>
                <h3 style={S.sectionTitle}>Your Legal Reviewer</h3>

                {approverEmail ? (
                  <div style={S.reviewerRow}>
                    <div style={S.avatar}>
                      {approverName ? approverName.charAt(0).toUpperCase() : emailInitials(approverEmail)}
                    </div>
                    <div style={S.reviewerInfo}>
                      <span style={S.reviewerName}>
                        {approverName || emailToName(approverEmail)}
                      </span>
                      <span style={S.reviewerRole}>Legal Reviewer</span>
                      <a href={`mailto:${approverEmail}`} style={S.reviewerEmail}>
                        {approverEmail}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p style={S.emptyText}>No reviewer assigned yet.</p>
                )}
              </div>

              {/* Feedback card — driven by ApproverComments JSON */}
              <div style={{ ...S.card, marginTop: 16 }}>
                <h3 style={S.sectionTitle}>Feedback &amp; Change Requests</h3>

                {(!request.approverHistory || request.approverHistory.length === 0) ? (
                  <p style={S.emptyText}>No feedback recorded yet.</p>
                ) : (
                  <div>
                    {[...request.approverHistory].reverse().map((entry: ApproverComment, idx: number) => (
                      <div
                        key={`${entry.version}-${entry.timestamp}`}
                        style={{
                          ...S.feedbackItem,
                          borderBottom: idx < request.approverHistory.length - 1
                            ? '1px solid #f3f4f6'
                            : 'none',
                        }}
                      >
                        {/* Status badge + version */}
                        <div style={S.fbTop}>
                          <WfBadge status={entry.status} />
                          <span style={S.fbVersion}>v{entry.version}</span>
                        </div>

                        {/* Comment */}
                        {entry.comment && (
                          <p style={S.fbComment}>{entry.comment}</p>
                        )}

                        {/* Reviewer email + timestamp */}
                        <div style={S.fbMeta}>
                          <span style={S.fbActor}>
                            {emailToName(entry.approver)} ({entry.approver})
                          </span>
                          <span style={S.fbDate}>{formatDateTime(entry.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: 'linear-gradient(160deg, #c8e6e3 0%, #ddf0ee 40%, #eef8f6 100%)',
  },

  // Navbar
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 40px',
    background: '#ffffff',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10 },
  brandText: { fontSize: 22, fontWeight: 700, color: '#1a1a1a' },
  brandAccent: { color: '#1a9b70' },

  // Main
  main: { maxWidth: 1180, margin: '0 auto', padding: '32px 40px 60px' },

  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, color: '#374151',
    padding: '6px 0', marginBottom: 24,
  },

  stateText: { color: '#6b7280', fontSize: 14 },
  errorBanner: {
    color: '#991b1b', background: '#fef2f2', padding: '12px 16px',
    borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid #fca5a5',
  },

  // Two-column grid
  grid: { display: 'flex', gap: 20, alignItems: 'flex-start' },
  leftCol:  { flex: '2 1 0', minWidth: 0 },
  rightCol: { flex: '1 1 0', minWidth: 280 },

  // Card
  card: {
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
    padding: '24px 28px',
  },

  // Review card header
  reviewTitleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 12, flexWrap: 'wrap', marginBottom: 32,
  },
  reviewTitle: { fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, flex: 1 },
  statusBadge: {
    display: 'inline-block', padding: '5px 16px', borderRadius: 20,
    fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
  },

  // Timeline
  timelineWrap: {
    display: 'flex', alignItems: 'flex-start', position: 'relative', padding: '0 0 8px',
  },
  bgLine: {
    position: 'absolute', top: 22, left: '12.5%', right: '12.5%',
    height: 3, background: '#e5e7eb', zIndex: 0,
  },
  greenLine: {
    position: 'absolute', top: 22, left: '12.5%',
    height: 3, background: '#16a34a', zIndex: 0,
    transition: 'width 0.5s ease',
  },
  stageCol: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    position: 'relative', zIndex: 1, gap: 6,
  },
  stageLabel: { fontSize: 13, textAlign: 'center', marginTop: 2 },
  stageDate:  { fontSize: 11, color: '#9ca3af', textAlign: 'center' },

  // Section title
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' },

  // Document row
  docRow: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
    borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap',
  },
  fileIcon: {
    width: 44, height: 44, background: '#f5f3ff', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  fileInfo: { flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 2 },
  fileLink: { fontSize: 14, fontWeight: 600, color: '#0891b2', textDecoration: 'none' },
  fileMeta: { fontSize: 12, color: '#9ca3af' },
  docActions: { display: 'flex', alignItems: 'center', gap: 4 },
  viewLink: { fontSize: 13, color: '#0891b2', textDecoration: 'none', fontWeight: 500 },
  actionDot: { color: '#9ca3af', fontSize: 13 },
  uploadLink: { fontSize: 13, color: '#7c3aed', fontWeight: 500, cursor: 'pointer' },

  metaRow: {
    display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12,
  },
  metaPill: {
    padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 500,
    background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
  },

  // Reviewer card
  reviewerRow: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  avatar: {
    width: 48, height: 48, borderRadius: '50%', background: '#1a6b5a',
    color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  reviewerInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  reviewerName: { fontSize: 15, fontWeight: 700, color: '#111827' },
  reviewerRole: { fontSize: 12, color: '#6b7280' },
  reviewerEmail: { fontSize: 13, color: '#0891b2', textDecoration: 'none', marginTop: 4 },
  emptyText: { fontSize: 13, color: '#9ca3af', margin: 0 },

  // Feedback items
  feedbackItem: {
    padding: '14px 0',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  fbTop:     { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const },
  fbVersion: { fontSize: 11, fontWeight: 600, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 10 },
  fbComment: { fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5 },
  fbMeta:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fbActor:   { fontSize: 12, fontWeight: 600, color: '#6b7280' },
  fbDate:    { fontSize: 11, color: '#9ca3af' },
};

export default RequestDetail;
