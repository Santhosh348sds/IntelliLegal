// pages/NewRequest.tsx - COMPLETE REPLACEMENT
import React, { useState, useEffect } from "react";
import {
  getApprovers,
  checkUser,
  uploadDocument,
  createRequest,
  CreateRequestData,
} from "../services/sharepointService";
import { Approver } from "../types";

interface NewRequestProps {
  onBack: () => void;
  userEmail: string;
  userName: string;
}

// Document type options
const DOC_TYPES = [
  { value: "NDA", label: "NDA", color: "#7C3AED", bg: "#EDE9FE" },
  { value: "MSA", label: "MSA", color: "#4F46E5", bg: "#E0E7FF" },
];

// Priority options
const PRIORITIES = [
  { value: "High", label: "High", color: "#DC2626", bg: "#FEE2E2" },
  { value: "Medium", label: "Medium", color: "#D97706", bg: "#FEF3C7" },
  { value: "Low", label: "Low", color: "#16A34A", bg: "#DCFCE7" },
];

const NewRequest: React.FC<NewRequestProps> = ({
  onBack,
  userEmail,
  userName,
}) => {
  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [documentType, setDocumentType] = useState("NDA");
  const [priority, setPriority] = useState("Medium");
  const [opportunityValue, setOpportunityValue] = useState("");
  const [businessBackground, setBusinessBackground] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedApprover, setSelectedApprover] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log("[NewRequest] Loading approvers");
      const approversList = await getApprovers();
      setApprovers(approversList);

      // Auto-select if only one approver
      if (approversList.length === 1) {
        setSelectedApprover(approversList[0].id);
      }
    } catch (err: any) {
      console.error("[NewRequest] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Format Indian number
  const formatIndianNumber = (value: string): string => {
    const num = value.replace(/\D/g, "");
    if (!num) return "";
    const lastThree = num.slice(-3);
    const rest = num.slice(0, -3);
    if (rest) {
      const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      return `${formattedRest},${lastThree}`;
    }
    return lastThree;
  };

  const handleOpportunityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIndianNumber(e.target.value);
    setOpportunityValue(formatted);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check if it's a .docx file
      if (!selectedFile.name.endsWith(".docx")) {
        setValidationErrors({
          ...validationErrors,
          file: "Only .docx files are allowed",
        });
        return;
      }
      // Check size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setValidationErrors({
          ...validationErrors,
          file: "File must be smaller than 10MB",
        });
        return;
      }
      setFile(selectedFile);
      setValidationErrors({ ...validationErrors, file: "" });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!customerName.trim()) errors.customerName = "Customer name is required";
    if (!opportunityValue)
      errors.opportunityValue = "Opportunity value is required";
    if (!businessBackground.trim())
      errors.businessBackground = "Business background is required";
    if (businessBackground.trim().length < 100)
      errors.businessBackground = "Minimum 100 characters required";
    if (!file) errors.file = "Please upload a document";
    if (approvers.length > 1 && !selectedApprover)
      errors.approver = "Please select an approver";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setShowConfirm(false);
    setSubmitting(true);

    try {
      // Step 1: Upload file
      console.log("[NewRequest] Uploading file");
      const uploadResult = await uploadDocument(file!);
      console.log("[NewRequest] File uploaded:", uploadResult);

      // In confirmSubmit function, update requestData:
      const requestData: CreateRequestData = {
        customerName,
        documentType,
        priority,
        opportunityValue: parseInt(opportunityValue.replace(/,/g, ""), 10),
        businessBackground,
        remarks,
        fileId: uploadResult.fileId,
        fileUrl: uploadResult.fileUrl,
        fileName: uploadResult.fileName,
        // approverUserId: selectedApprover || approvers[0]?.userId,  // ADD
        approverEmail:
          approvers.find((a) => a.id === selectedApprover)?.email ||
          approvers[0]?.email,
        userEmail,
        userName,
      };

      console.log("[NewRequest] Creating request");
      const result = await createRequest(requestData);
      console.log("[NewRequest] Request created:", result);

      setRequestTitle(result.requestTitle);
      setShowSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (err: any) {
      console.error("[NewRequest] Submit error:", err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading...</div>;
  }

  if (error && !submitting) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Error: {error}</div>
        <button onClick={onBack} style={styles.backBtn}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>
          ← Back
        </button>
        <h1 style={styles.title}>Legal Documentation Form</h1>
      </div>

      {/* Form Card */}
      <div style={styles.formCard}>
        {/* Customer Name & Approver Row */}
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Customer Name <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Search or enter customer name"
              style={styles.input}
            />
            {validationErrors.customerName && (
              <span style={styles.errorText}>
                {validationErrors.customerName}
              </span>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Approver ({approvers.length})
              {approvers.length > 1 && <span style={styles.required}>*</span>}
            </label>
            <select
              value={selectedApprover}
              onChange={(e) => setSelectedApprover(e.target.value)}
              disabled={approvers.length === 1}
              style={styles.select}
            >
              {approvers.length > 1 && (
                <option value="">Select an approver</option>
              )}
              {approvers.map((approver) => (
                <option key={approver.id} value={approver.id}>
                  {approver.title} ({approver.email})
                </option>
              ))}
            </select>
            {validationErrors.approver && (
              <span style={styles.errorText}>{validationErrors.approver}</span>
            )}
          </div>
        </div>

        {/* Document Type & Priority Row */}
        <div style={styles.formRow}>
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
                    backgroundColor:
                      documentType === doc.value ? doc.bg : "#F3F4F6",
                    color: documentType === doc.value ? doc.color : "#6B7280",
                    borderColor:
                      documentType === doc.value ? doc.color : "transparent",
                  }}
                >
                  {doc.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Priority <span style={styles.required}>*</span>
            </label>
            <div style={styles.pillGroup}>
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  style={{
                    ...styles.pill,
                    backgroundColor: priority === p.value ? p.bg : "#F3F4F6",
                    color: priority === p.value ? p.color : "#6B7280",
                    borderColor: priority === p.value ? p.color : "transparent",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Opportunity Value Row */}
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Opportunity Value <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={opportunityValue}
              onChange={handleOpportunityChange}
              placeholder="Enter opportunity value"
              style={styles.input}
            />
            {validationErrors.opportunityValue && (
              <span style={styles.errorText}>
                {validationErrors.opportunityValue}
              </span>
            )}
          </div>
          <div style={styles.formGroup}>{/* Empty for layout */}</div>
        </div>

        {/* File Upload */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Attach document for review <span style={styles.required}>*</span>
          </label>
          <div style={styles.uploadArea}>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              style={styles.fileInput}
              id="file-upload"
            />
            <label htmlFor="file-upload" style={styles.uploadLabel}>
              {file
                ? file.name
                : "No file selected. Please upload a .docx file only."}
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
          <div style={styles.charCount}>
            {businessBackground.length}/2000 characters
          </div>
          {validationErrors.businessBackground && (
            <span style={styles.errorText}>
              {validationErrors.businessBackground}
            </span>
          )}
        </div>

        {/* Remarks */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter description for Remark"
            rows={3}
            style={styles.textarea}
          />
        </div>

        {/* Form Actions */}
        <div style={styles.formActions}>
          <button onClick={onBack} style={styles.cancelButton}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={styles.submitButton}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Confirm Submit</h3>
            <p>Are you sure? You are about to submit the form.</p>
            <div style={styles.modalActions}>
              <button
                onClick={() => setShowConfirm(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button onClick={confirmSubmit} style={styles.submitButton}>
                Yes, Submit
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
            <h3 style={styles.successTitle}>Success!</h3>
            <p>Your request {requestTitle} has been submitted successfully.</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, rgba(51, 216, 158, 0.24) 9.45%, rgba(54, 136, 136, 0.06) 100%)",
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
    background: "#fff",
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
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 40,
    marginBottom: 24,
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
  input: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
  },
  select: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    background: "#fff",
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
  uploadIcon: {
    fontSize: 16,
  },
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
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
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
  error: {
    color: "#c0392b",
    background: "#fdecea",
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
};

export default NewRequest;
