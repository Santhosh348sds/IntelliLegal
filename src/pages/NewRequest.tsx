// pages/NewRequest.tsx
import React, { useState } from "react";
import { LdraRequest } from "../types";
import {
  uploadDocument,
  createRequest,
  updateRequest,
  CreateRequestData,
} from "../services/sharepointService";

interface NewRequestProps {
  onBack: () => void;
  onSubmitSuccess?: () => void; // called after successful submit — triggers dashboard refresh
  userEmail: string;
  userName: string;
  existingRequest?: LdraRequest; // when provided → resubmit/edit mode
}

const DOC_TYPES = [
  { value: "NDA", label: "NDA", color: "#7C3AED", bg: "#EDE9FE" },
  { value: "MSA", label: "MSA", color: "#4F46E5", bg: "#E0E7FF" },
];

const NewRequest: React.FC<NewRequestProps> = ({ onBack, onSubmitSuccess, userEmail, userName, existingRequest }) => {
  const isEdit = !!existingRequest;

  // Find the latest Re-Progress comment from the approver to show as a notice
  const approverNotice = isEdit
    ? [...(existingRequest!.approverHistory ?? [])]
        .reverse()
        .find((h) => h.status === "Re-Progress" || h.status === "Reprogress")
    : undefined;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState(existingRequest?.customerName ?? "");
  const [documentType, setDocumentType] = useState(existingRequest?.documentType ?? "NDA");
  const [businessBackground, setBusinessBackground] = useState(existingRequest?.futurePotential ?? "");
  const [remarks, setRemarks] = useState(existingRequest?.remarks ?? "");
  const [file, setFile] = useState<File | null>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [requestTitle, setRequestTitle] = useState(existingRequest?.title ?? "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".docx")) {
        setValidationErrors({ ...validationErrors, file: "Only .docx files are allowed" });
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setValidationErrors({ ...validationErrors, file: "File must be smaller than 10MB" });
        return;
      }
      setFile(selectedFile);
      setValidationErrors({ ...validationErrors, file: "" });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!customerName.trim()) errors.customerName = "Customer name is required";
    if (!businessBackground.trim()) errors.businessBackground = "Business background is required";
    if (businessBackground.trim().length < 100)
      errors.businessBackground = "Minimum 100 characters required";
    // File required only for new requests; optional on resubmit (keep existing)
    if (!isEdit && !file) errors.file = "Please upload a document";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      let fileId: string | undefined;
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      // Upload new file only if one was selected
      if (file) {
        const uploadResult = await uploadDocument(file);
        fileId = uploadResult.fileId;
        fileUrl = uploadResult.fileUrl;
        fileName = uploadResult.fileName;
      }

      if (isEdit) {
        // Resubmit: update existing request → status becomes Pending
        await updateRequest(existingRequest!.title, {
          customerName,
          documentType,
          businessBackground,
          remarks,
          fileId,
          fileUrl,
        });
        setRequestTitle(existingRequest!.title);
      } else {
        // New request
        const requestData: CreateRequestData = {
          customerName,
          documentType,
          businessBackground,
          remarks,
          fileId: fileId!,
          fileUrl: fileUrl!,
          fileName,
          userEmail,
          userName,
        };
        const result = await createRequest(requestData);
        setRequestTitle(result.requestTitle);
      }

      setShowSuccess(true);
      setTimeout(() => { (onSubmitSuccess ?? onBack)(); }, 2000);
    } catch (err: any) {
      console.error("[NewRequest] Submit error:", err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (error && !submitting) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>Error: {error}</div>
        <button onClick={onBack} style={styles.backBtn}>Back to Home</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <h1 style={styles.title}>
          {isEdit ? `Resubmit Request — ${existingRequest!.title}` : "Legal Documentation Form"}
        </h1>
      </div>

      {/* Form Card */}
      <div style={styles.formCard}>

        {/* Approver comment notice — shown only in resubmit mode */}
        {isEdit && approverNotice && (
          <div style={styles.approverNotice}>
            <div style={styles.approverNoticeHeader}>
              <span style={styles.approverNoticeIcon}>💬</span>
              <strong>Reviewer's Comment</strong>
              <span style={styles.approverNoticeDate}>
                {new Date(approverNotice.timestamp).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </span>
            </div>
            <p style={styles.approverNoticeComment}>{approverNotice.comment}</p>
            <span style={styles.approverNoticeBy}>— {approverNotice.approver}</span>
          </div>
        )}

        {/* Customer Name */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Customer Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter customer name"
            style={styles.input}
          />
          {validationErrors.customerName && (
            <span style={styles.errorText}>{validationErrors.customerName}</span>
          )}
        </div>

        {/* Document Type */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Document Type <span style={styles.required}>*</span>
          </label>
          <div style={styles.pillGroup}>
            {DOC_TYPES.map((doc) => (
              <button
                key={doc.value}
                type="button"
                onClick={() => setDocumentType(doc.value)}
                style={{
                  ...styles.pill,
                  backgroundColor: documentType === doc.value ? doc.bg : "#F3F4F6",
                  color: documentType === doc.value ? doc.color : "#6B7280",
                  borderColor: documentType === doc.value ? doc.color : "transparent",
                }}
              >
                {doc.label}
              </button>
            ))}
          </div>
        </div>

        {/* File Upload */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Attach document for review{" "}
            {!isEdit && <span style={styles.required}>*</span>}
            {isEdit && <span style={styles.optionalHint}> (leave empty to keep existing)</span>}
          </label>
          {/* Show existing file link in edit mode */}
          {isEdit && existingRequest!.documentUrl && !file && (
            <a
              href={`${existingRequest!.documentUrl}?web=1`}
              target="_blank"
              rel="noreferrer"
              style={styles.existingFileLink}
            >
              📄 Current document (click to view)
            </a>
          )}
          <div style={styles.uploadArea}>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              style={styles.fileInput}
              id="file-upload"
            />
            <label htmlFor="file-upload" style={styles.uploadLabel}>
              {file ? file.name : "Click to upload a new .docx file"}
              <span style={styles.uploadIcon}>📎</span>
            </label>
          </div>
          {validationErrors.file && (
            <span style={styles.errorText}>{validationErrors.file}</span>
          )}
        </div>

        {/* Business Background */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Business Background <span style={styles.required}>*</span>
          </label>
          <textarea
            value={businessBackground}
            onChange={(e) => setBusinessBackground(e.target.value)}
            placeholder="Enter Business Background (minimum 100 characters)"
            rows={4}
            style={styles.textarea}
          />
          <div style={styles.charCount}>{businessBackground.length}/2000 characters</div>
          {validationErrors.businessBackground && (
            <span style={styles.errorText}>{validationErrors.businessBackground}</span>
          )}
        </div>

        {/* Remarks */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter remarks (optional)"
            rows={3}
            style={styles.textarea}
          />
        </div>

        {/* Actions */}
        <div style={styles.formActions}>
          <button onClick={onBack} style={styles.cancelButton}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={styles.submitButton}>
            {submitting ? "Submitting..." : isEdit ? "Resubmit" : "Submit"}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>{isEdit ? "Confirm Resubmit" : "Confirm Submit"}</h3>
            <p>
              {isEdit
                ? `Resubmit ${existingRequest!.title}? The status will change to "Pending".`
                : "Are you sure? You are about to submit the form."}
            </p>
            <div style={styles.modalActions}>
              <button onClick={() => setShowConfirm(false)} style={styles.cancelButton}>Cancel</button>
              <button onClick={confirmSubmit} style={styles.submitButton}>
                {isEdit ? "Yes, Resubmit" : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.successIcon}>✓</div>
            <h3 style={styles.successTitle}>
              {isEdit ? "Resubmitted!" : "Success!"}
            </h3>
            <p>
              {isEdit
                ? `Request ${requestTitle} has been resubmitted successfully.`
                : `Your request ${requestTitle} has been submitted successfully.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    minHeight: "100vh",
    background: "linear-gradient(180deg, rgba(51, 216, 158, 0.24) 9.45%, rgba(54, 136, 136, 0.06) 100%)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    marginBottom: 24,
  },
  backBtn: {
    padding: "8px 12px",
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 16,
  },
  title: {
    margin: 0,
    color: "#059669",
    fontSize: 24,
    fontWeight: 500,
  },
  formCard: {
    background: "#fff",
    borderRadius: 8,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
  },
  required: {
    color: "#ef4444",
    marginLeft: 2,
  },
  optionalHint: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: 400,
  },
  input: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
  },
  pillGroup: {
    display: "flex",
    gap: 12,
  },
  pill: {
    padding: "6px 16px",
    borderRadius: 20,
    border: "2px solid transparent",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  existingFileLink: {
    fontSize: 13,
    color: "#0891b2",
    textDecoration: "underline",
  },
  uploadArea: {
    position: "relative",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    overflow: "hidden",
  },
  fileInput: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: "100%",
    cursor: "pointer",
  },
  uploadLabel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    fontSize: 14,
    color: "#6b7280",
    cursor: "pointer",
  },
  uploadIcon: { fontSize: 16 },
  textarea: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    resize: "vertical",
  },
  charCount: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "right",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
  },
  approverNotice: {
    background: "#fffbeb",
    border: "1.5px solid #d97706",
    borderRadius: 8,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  approverNoticeHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#92400e",
  },
  approverNoticeIcon: { fontSize: 16 },
  approverNoticeDate: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: 400,
    color: "#a16207",
  },
  approverNoticeComment: {
    margin: 0,
    fontSize: 14,
    color: "#451a03",
    lineHeight: 1.6,
  },
  approverNoticeBy: {
    fontSize: 12,
    color: "#a16207",
    fontStyle: "italic",
  },

  errorBox: {
    color: "#c0392b",
    background: "#fdecea",
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    paddingTop: 24,
    borderTop: "1px solid #e5e7eb",
  },
  cancelButton: {
    padding: "8px 16px",
    borderRadius: 20,
    border: "none",
    background: "#f3f4f6",
    color: "#374151",
    cursor: "pointer",
  },
  submitButton: {
    padding: "8px 16px",
    borderRadius: 4,
    border: "none",
    background: "#14b8a6",
    color: "#fff",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    background: "#fff",
    padding: 24,
    borderRadius: 8,
    minWidth: 400,
    textAlign: "center",
  },
  modalActions: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    marginTop: 24,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "#dcfce7",
    color: "#16a34a",
    fontSize: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  successTitle: {
    color: "#15803d",
    marginBottom: 8,
  },
};

export default NewRequest;
