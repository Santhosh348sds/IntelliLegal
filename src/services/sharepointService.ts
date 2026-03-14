// import { DriveItem, DocStatus, ReviewPayload } from '../types';

// // ── Internal fetch helper ─────────────────────────────────────────────────────

// async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
//   const response = await fetch(url, options);
//   const contentType = response.headers.get('content-type') ?? '';
//   if (!contentType.includes('application/json')) {
//     throw new Error('Backend server is not running. Start the app with "npm start".');
//   }
//   const data = await response.json();
//   if (!response.ok) throw new Error(data.error ?? `Request failed: ${response.statusText}`);
//   return data;
// }

// // ── Public API ────────────────────────────────────────────────────────────────

// export async function fetchDocuments(): Promise<DriveItem[]> {
//   return apiCall<DriveItem[]>('/api/documents');
// }

// export async function fetchDocumentStatuses(): Promise<Record<string, DocStatus>> {
//   return apiCall<Record<string, DocStatus>>('/api/document-statuses');
// }

// export async function getNextVersion(documentId: string): Promise<string> {
//   const data = await apiCall<{ nextVersion: string }>(
//     `/api/review-version/${encodeURIComponent(documentId)}`
//   );
//   return data.nextVersion;
// }

// export async function submitReview(payload: ReviewPayload): Promise<void> {
//   await apiCall('/api/review', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload),
//   });
// }

























































// new codes



// services/sharepointService.ts - COMPLETE FILE
import { DriveItem, DocStatus, ReviewPayload, Approver, UserCheckResult, LdraRequest, WorkflowHistoryItem } from '../types';

// ── Internal fetch helper ─────────────────────────────────────────────────────

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Backend server is not running. Start the app with "npm start".');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Request failed: ${response.statusText}`);
  return data;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchDocuments(): Promise<DriveItem[]> {
  return apiCall<DriveItem[]>('/api/documents');
}

export async function fetchDocumentStatuses(): Promise<Record<string, DocStatus>> {
  return apiCall<Record<string, DocStatus>>('/api/document-statuses');
}

export async function getNextVersion(documentId: string): Promise<string> {
  const data = await apiCall<{ nextVersion: string }>(
    `/api/review-version/${encodeURIComponent(documentId)}`
  );
  return data.nextVersion;
}

export async function submitReview(payload: ReviewPayload): Promise<void> {
  await apiCall('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ── New Request APIs ──────────────────────────────────────────────────────────

export async function getApprovers(): Promise<Approver[]> {
  console.log('[Service] Fetching approvers');
  return apiCall<Approver[]>('/api/approvers');
}

export async function checkUser(email: string): Promise<UserCheckResult> {
  console.log('[Service] Checking user:', email);
  return apiCall<UserCheckResult>('/api/check-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
}

// export async function uploadDocument(file: File): Promise<any> {
//   console.log('[Service] Uploading document:', file.name);
//   // Will implement after basic setup
//   throw new Error('Not implemented yet');
// }

// export async function createRequest(data: any): Promise<any> {
//   console.log('[Service] Creating request:', data);
//   return apiCall('/api/create-request', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(data)
//   });
// }

















// Update these functions in sharepointService.ts

export interface UploadResult {
  fileId: string;
  fileName: string;
  fileUrl: string;
}

// export interface CreateRequestData {
//   customerName: string;
//   documentType: string;
//   priority: string;
//   opportunityValue: number;
//   businessBackground: string;
//   remarks: string;
//   fileId: string;
//   fileUrl: string;
//   assignedApproverId?: string;
//   userEmail: string;
//   userName: string;
// }

export interface CreateRequestData {
  customerName: string;
  documentType: string;
  priority: string;
  opportunityValue: number;
  businessBackground: string;
  remarks: string;
  fileId: string;
  fileUrl: string;
  fileName?: string;        // ADD
  // approverUserId?: string;  // ADD
  approverEmail?: string; 
  userEmail: string;
  userName: string;
}

export interface CreateRequestResult {
  success: boolean;
  requestId: string;
  requestTitle: string;
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  console.log('[Service] Uploading document:', file.name);
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload-document', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }
  
  return response.json();
}

export async function createRequest(data: CreateRequestData): Promise<CreateRequestResult> {
  console.log('[Service] Creating request:', data);
  return apiCall<CreateRequestResult>('/api/create-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// ── Request Detail APIs ───────────────────────────────────────────────────────

export async function fetchMyRequests(email: string): Promise<LdraRequest[]> {
  return apiCall<LdraRequest[]>(`/api/my-requests?email=${encodeURIComponent(email)}`);
}

export async function fetchRequest(requestTitle: string): Promise<LdraRequest> {
  return apiCall<LdraRequest>(`/api/request/${encodeURIComponent(requestTitle)}`);
}

export async function fetchWorkflowHistory(requestTitle: string): Promise<WorkflowHistoryItem[]> {
  return apiCall<WorkflowHistoryItem[]>(`/api/workflow-history/${encodeURIComponent(requestTitle)}`);
}