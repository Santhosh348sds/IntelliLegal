import React, { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { LdraRequest } from "../types";
import { fetchMyRequests } from "../services/sharepointService";
import Pagination from "../components/Pagination";
import NewRequest from "./NewRequest";
import RequestDetail from "./RequestDetail";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  New:           { label: "New",              color: "#0891b2", bg: "#ecfeff", border: "1.5px solid #0891b2" },
  Pending:       { label: "Under Review",     color: "#d97706", bg: "#fffbeb", border: "1.5px solid #d97706" },
  Approved:      { label: "Approved",         color: "#16a34a", bg: "#f0fdf4", border: "1.5px solid #16a34a" },
  Rejected:      { label: "Rejected",         color: "#dc2626", bg: "#fef2f2", border: "1.5px solid #dc2626" },
  Reprogress:    { label: "Revision Required",color: "#d97706", bg: "#fffbeb", border: "1.5px solid #d97706" },
  "Re-Progress": { label: "Revision Required",color: "#d97706", bg: "#fffbeb", border: "1.5px solid #d97706" },
  Resubmitted:   { label: "Resubmitted",      color: "#7c3aed", bg: "#f5f3ff", border: "1.5px solid #7c3aed" },
  "Re-Submit":   { label: "Resubmitted",      color: "#7c3aed", bg: "#f5f3ff", border: "1.5px solid #7c3aed" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { label: status, color: "#6b7280", bg: "#f9fafb", border: "1.5px solid #9ca3af" };
  return (
    <span style={{
      display: "inline-block", padding: "3px 12px", borderRadius: 20,
      fontSize: 12, fontWeight: 600,
      color: c.color, background: c.bg, border: c.border,
    }}>
      {c.label}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const Home: React.FC = () => {
  const { instance, accounts } = useMsal();
  const userEmail = accounts[0]?.username ?? "";
  const userName  = accounts[0]?.name ?? "";

  // ── State ──────────────────────────────────────────────────────────────────

  const [requests,    setRequests]    = useState<LdraRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentView, setCurrentView] = useState<"home" | "newRequest">("home");
  const [selectedReq, setSelectedReq] = useState<string | null>(null); // requestTitle

  // ── Data loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userEmail) return;
    setLoading(true);
    fetchMyRequests(userEmail)
      .then((data) => { setRequests(data); })
      .catch((err: Error) => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [userEmail]);

  useEffect(() => { setCurrentPage(1); }, [requests]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const pagedReqs = requests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleNewRequest = () => setCurrentView("newRequest");
  const handleBackToHome = () => { setCurrentView("home"); setSelectedReq(null); };

  // ── Views ──────────────────────────────────────────────────────────────────

  if (currentView === "newRequest") {
    return <NewRequest onBack={handleBackToHome} userEmail={userEmail} userName={userName} />;
  }

  if (selectedReq) {
    return <RequestDetail requestTitle={selectedReq} onBack={() => setSelectedReq(null)} />;
  }

  // ── Home view ──────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>

      {/* ── Navbar ── */}
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <svg width="36" height="36" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L4 10v12c0 10.5 7.7 20.3 18 22.6C32.3 42.3 40 32.5 40 22V10L22 2z"
              fill="url(#shieldG2)" />
            <defs>
              <linearGradient id="shieldG2" x1="4" y1="2" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2d9cdb" />
                <stop offset="100%" stopColor="#1a6b5a" />
              </linearGradient>
            </defs>
            <path d="M15 22l5 5 9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={styles.brandText}>
            Intelli<span style={styles.brandAccent}>Legal</span>
          </span>
        </div>

        <div style={styles.headerRight}>
          <button style={styles.newRequestBtn} onClick={handleNewRequest}>
            + New Request
          </button>
          <div style={styles.userPill}>
            <div style={styles.avatar}>{userName.charAt(0).toUpperCase()}</div>
            <span style={styles.userName}>{userName}</span>
          </div>
          <button
            style={styles.signOutBtn}
            onClick={() => instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={styles.main}>

        <h1 style={styles.dashTitle}>My Dashboard</h1>
        <p style={styles.dashSubtitle}>
          Track the progress and details of your active legal document review.
        </p>

        {/* States */}
        {loading && <p style={styles.stateText}>Loading requests…</p>}
        {fetchError && <div style={styles.errorBanner}>Error: {fetchError}</div>}
        {!loading && !fetchError && requests.length === 0 && (
          <p style={styles.stateText}>No requests found for your account.</p>
        )}

        {/* Requests card */}
        {!loading && !fetchError && requests.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>My Requests</h2>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Request ID", "Customer Name", "Document Type", "Priority", "Status", "Last Updated"].map((col) => (
                      <th key={col} style={styles.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedReqs.map((req) => (
                    <tr key={req.id} style={styles.tr}>
                      <td style={styles.td}>
                        <button
                          style={styles.fileLinkBtn}
                          onClick={() => setSelectedReq(req.title)}
                        >
                          {req.title}
                        </button>
                      </td>
                      <td style={styles.td}>{req.customerName || "—"}</td>
                      <td style={styles.td}>{req.documentType || "—"}</td>
                      <td style={styles.td}>
                        {req.priority ? (
                          <span style={styles.priorityPill}>{req.priority}</span>
                        ) : "—"}
                      </td>
                      <td style={styles.td}>
                        <StatusBadge status={req.status} />
                      </td>
                      <td style={{ ...styles.td, color: "#9ca3af", fontSize: 13 }}>
                        {formatDate(req.lastStatusChange)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              total={requests.length}
              page={currentPage}
              pageSize={PAGE_SIZE}
              onChange={setCurrentPage}
            />
          </div>
        )}
      </main>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {

  page: {
    minHeight: "100vh",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: "linear-gradient(160deg, #c8e6e3 0%, #ddf0ee 40%, #eef8f6 100%)",
  },

  // Navbar
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 40px",
    background: "#ffffff",
    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    flexWrap: "wrap",
    gap: 12,
  },
  logoRow: { display: "flex", alignItems: "center", gap: 10 },
  brandText: { fontSize: 22, fontWeight: 700, color: "#1a1a1a" },
  brandAccent: { color: "#1a9b70" },

  headerRight: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  newRequestBtn: {
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    background: "#1a6b5a",
    color: "#fff",
    cursor: "pointer",
  },
  userPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    background: "#f3f4f6",
    borderRadius: 24,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1a6b5a",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 600, color: "#374151" },
  signOutBtn: {
    padding: "7px 14px",
    fontSize: 13,
    borderRadius: 7,
    border: "1px solid #e0b0b0",
    background: "#fff",
    color: "#c0392b",
    cursor: "pointer",
  },

  // Main
  main: { maxWidth: 1180, margin: "0 auto", padding: "40px 40px 60px" },

  dashTitle: { fontSize: 24, fontWeight: 700, color: "#111827", margin: "0 0 6px" },
  dashSubtitle: { fontSize: 14, color: "#6b7280", margin: "0 0 28px" },

  stateText: { color: "#6b7280", fontSize: 14 },
  errorBanner: {
    color: "#991b1b",
    background: "#fef2f2",
    padding: "12px 16px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    border: "1px solid #fca5a5",
  },

  // Card
  card: {
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 2px 20px rgba(0,0,0,0.07)",
    padding: "28px 32px 20px",
  },
  cardTitle: { fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 24px" },

  // Table
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 720 },
  th: {
    textAlign: "left",
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 500,
    color: "#9ca3af",
    borderBottom: "1px solid #f3f4f6",
    background: "transparent",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "16px", fontSize: 14, color: "#374151", verticalAlign: "middle" },

  fileLinkBtn: {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 14,
    fontWeight: 600,
    color: "#0891b2",
    cursor: "pointer",
    textAlign: "left" as const,
    textDecoration: "underline",
    textUnderlineOffset: 2,
  },

  priorityPill: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: "#f9fafb",
    color: "#374151",
    border: "1px solid #e5e7eb",
  },
};

export default Home;
