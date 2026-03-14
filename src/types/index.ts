// ── Domain models ─────────────────────────────────────────────────────────────

export interface DriveItem {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  webUrl: string;
  file?: { mimeType: string };
  Document_ID: string | null;
  _listFetchError?: string | null;
}

export interface DocStatus {
  status: string; // 'Approved' | 'Reprogress' | 'Re-Submit'
  version: string;
}

export interface ReviewPayload {
  documentName: string;
  documentId: string;
  docVersion: string;
  reviewStatus: 'Approved' | 'Reprogress' | 'Re-Submit';
  reviewerEmail: string;
  comments: string;
}

// ── UI state ──────────────────────────────────────────────────────────────────

export type ActionType = 'Approved' | 'Reprogress' | 'Re-Submit';

export interface FormState {
  documentId: string;
  email: string;
  comments: string;
  submitting: boolean;
  error: string | null;
}

export interface ModalState {
  open: boolean;
  action: ActionType;
  doc: DriveItem | null;
}

// types/index.ts - ADD these at the end of your existing file

// ── New Request Types ─────────────────────────────────────────────────────────

export interface Approver {
  id: string;
  userId: string;
  title: string;
  email: string;
  department: string;
}

export interface UserCheckResult {
  exists: boolean;
  userType?: string;
  isActive?: boolean;
}






// Add to types/index.ts
export interface UploadResult {
  fileId: string;
  fileName: string;
  fileUrl: string;
}

export interface CreateRequestData {
  customerName: string;
  documentType: string;
  priority: string;
  opportunityValue: number;
  businessBackground: string;
  remarks: string;
  fileId: string;
  fileUrl: string;
  assignedApproverId?: string;
  userEmail: string;
  userName: string;
}

export interface CreateRequestResult {
  success: boolean;
  requestId: string;
  requestTitle: string;
}

// ── Request Detail Types ───────────────────────────────────────────────────────

/** Single entry stored in the LdraRequests.ApproverComments JSON array */
export interface ApproverComment {
  version: number;
  status: string;
  comment: string;
  approver: string;   // email of the reviewer who acted
  timestamp: string;  // ISO date string
}

export interface LdraRequest {
  id: string;
  title: string;
  customerName: string;
  customerType: string;
  opportunityValue: number;
  priority: string;
  documentType: string;
  otherDocType: string;
  status: string;
  requesterEmail: string;
  assignedApproverEmail: string;
  reviewerEmail: string;
  reviewerName: string;
  documentUrl: string;
  fileId: string;
  remarks: string;
  futurePotential: string;
  approverComments: string;
  approverHistory: ApproverComment[];   // parsed from ApproverComments JSON
  versionNumber: number;
  lastStatusChange: string;
}

export interface WorkflowHistoryItem {
  id: string;
  title: string;
  fromStatus: string;
  toStatus: string;
  actorName: string;
  actorEmail: string;
  actionDate: string;
  comments: string;
}