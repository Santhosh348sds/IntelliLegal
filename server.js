require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SITE_ID = '7ab8aee3-f427-44f0-b0cc-146fce45dccf';
const DRIVE_ID = 'b!4664eif08ESwzBRvzkXczxs_8fKtHpdKpcKVQuVYVta2E1ctwdwMQbIWnp2PkDaN';
const REVIEW_LIST = 'Document_Review_Tracking';

// In production the React build is served from the same origin — no CORS needed.
// In development allow localhost:3000 (CRA dev server).
if (!IS_PROD) {
  app.use(cors({ origin: 'http://localhost:3000' }));
}
app.use(express.json());

// Serve the React production build
if (IS_PROD) {
  app.use(express.static(path.join(__dirname, 'build')));
}

// Health check — lets the frontend confirm the backend is alive
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function getAccessToken() {
  const response = await axios.post(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data.access_token;
}

// Debug endpoint — open http://localhost:3001/api/debug to see all lists and field names
app.get('/api/debug', async (_req, res) => {
  try {
    const token = await getAccessToken();

    // All lists in the site
    const listsRes = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const lists = listsRes.data.value.map((l) => ({ id: l.id, name: l.name, displayName: l.displayName }));

    // First few list items from the drive's list with all fields
    let driveListItems = null;
    let driveListError = null;
    try {
      const driveListRes = await axios.get(
        `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/list/items?$expand=fields&$top=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      driveListItems = driveListRes.data.value.map((i) => ({
        id: i.id,
        fields: i.fields,
      }));
    } catch (e) {
      driveListError = e.response?.data?.error?.message || e.message;
    }

    res.json({ lists, driveListItems, driveListError });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Fetch documents — drive items merged with list items via drive's list endpoint
app.get('/api/documents', async (req, res) => {
  try {
    const token = await getAccessToken();

    // 1. Standard drive items
    const driveRes = await axios.get(
      `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root/children`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const driveFiles = driveRes.data.value.filter((item) => item.file);

    // 2. List items via drive's own list (no need to know the list name)
    let fieldsByFileName = {};
    let listFetchError = null;
    try {
      const listRes = await axios.get(
        `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/list/items?$expand=fields&$top=1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[Docs] List items returned: ${listRes.data.value.length}`);
      listRes.data.value.forEach((item) => {
        const fileName = item.fields?.FileLeafRef;
        // Use lowercase key for case-insensitive matching
        if (fileName) fieldsByFileName[fileName.toLowerCase()] = item.fields;
      });
      console.log(`[Docs] Mapped filenames: ${Object.keys(fieldsByFileName).join(', ') || '(none)'}`);
      const sampleFields = Object.values(fieldsByFileName)[0];
      if (sampleFields) {
        console.log('[Docs] All available field keys:', Object.keys(sampleFields));
        console.log('[Docs] Document_ID value sample:', sampleFields.Document_ID ?? '(not found)');
      }
    } catch (listErr) {
      listFetchError = listErr.response?.data?.error?.message || listErr.message;
      console.error('[Docs] Drive list items fetch failed:', listFetchError);
    }

    // 3. Merge by filename (case-insensitive)
    const files = driveFiles.map((item) => {
      const fields = fieldsByFileName[item.name.toLowerCase()] || {};
      const documentId =
        fields['Document_ID'] ??
        fields['Document_Id'] ??
        fields['DocumentID'] ??
        fields['document_id'] ??
        null;
      console.log(`[Docs] "${item.name}" → Document_ID: ${documentId ?? '(null)'}`);
      return {
        id: item.id,
        name: item.name,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        file: item.file,
        Document_ID: documentId,
        _listFetchError: listFetchError,
      };
    });

    res.json(files);
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    console.error('Error fetching documents:', message);
    res.status(status).json({ error: message });
  }
});

// Get the latest version for a given Document_ID from the review list
app.get('/api/review-version/:documentId', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { documentId } = req.params;

    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${REVIEW_LIST}/items` +
        `?$expand=fields&$filter=fields/Document_ID eq '${encodeURIComponent(documentId)}'`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          // Required when filtering on a non-indexed SharePoint column.
          // Safe for small lists; index the column in SharePoint to remove the need for this header.
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
        },
      }
    );

    const items = response.data.value;
    if (items.length === 0) {
      return res.json({ nextVersion: '1' });
    }

    const maxVersion = items.reduce((max, item) => {
      const v = parseInt(item.fields?.Doc_Version || '0', 10);
      return v > max ? v : max;
    }, 0);

    res.json({ nextVersion: String(maxVersion + 1) });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    console.error('Error fetching version:', message);
    res.status(status).json({ error: message });
  }
});

// Get latest review status per Document_ID (used to drive the UI state machine)
app.get('/api/document-statuses', async (_req, res) => {
  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${REVIEW_LIST}/items` +
        `?$expand=fields&$top=1000`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
        },
      }
    );

    // Sort newest-first in JS (avoids $orderby index requirement)
    const sorted = [...response.data.value].sort(
      (a, b) => new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime()
    );

    // Take the single latest entry per Document_ID
    const statusMap = {};
    sorted.forEach((item) => {
      const docId = item.fields?.Document_ID;
      if (docId && !statusMap[docId]) {
        statusMap[docId] = {
          status: item.fields?.Review_Status || '',
          version: item.fields?.Doc_Version || '0',
        };
      }
    });

    res.json(statusMap);
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    console.error('Error fetching document statuses:', message);
    res.status(status).json({ error: message });
  }
});

// Submit a review (approve or reject) to the SharePoint list
app.post('/api/review', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { documentName, documentId, docVersion, reviewStatus, reviewerEmail, comments } = req.body;

    await axios.post(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${REVIEW_LIST}/items`,
      {
        fields: {
          Title: `${documentName} - ${reviewStatus}`,
          Document_Name: documentName,
          Document_ID: documentId,
          Doc_Version: docVersion,
          Review_Status: reviewStatus,
          Reviewer_Email: reviewerEmail,
          Comments: comments || '',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ success: true });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message;
    console.error('Error submitting review:', message);
    res.status(status).json({ error: message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} is already in use by another process.`);
    console.error(`    Stop it first, then re-run npm start:`);
    console.error(`    Windows: netstat -ano | findstr :${PORT}  → then  taskkill /F /PID <pid>`);
    console.error(`    Or simply: npx kill-port ${PORT} && npm start\n`);
  } else {
    console.error('Server startup error:', err.message);
  }
  process.exit(1);
});












































// new codes


// phaSE 1 chcek 

// Add these constants at the top with other constants
const LDRA_USERS_LIST = '86865e1d-8cd2-462d-859b-e523f4207f47';
const LDRA_REQUESTS_LIST = 'e74b2d25-e227-4088-89ba-20b7f81dd743';
const LDRA_DOCUMENTS_LIBRARY = '2d5713b6-dcc1-410c-b216-9e9d8f90368d';










app.get('/api/approvers', async (req, res) => {
  console.log('[API] GET /api/approvers called');
  try {
    const token = await getAccessToken();
    
    // Fixed filter - boolean true needs to be just 'true' not 'eq true'
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_USERS_LIST}/items` +
      `?$expand=fields&$filter=fields/UserType eq 'APPROVER' and fields/IsActive eq 1`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly'
        } 
      }
    );
    
    console.log(`[API] Found ${response.data.value.length} approvers`);
    
    const approvers = response.data.value.map(item => ({
      id: item.id,
      userId: item.fields.UserId || item.id,
      title: item.fields.Title,
      email: item.fields.Email,
      department: item.fields.Department || ''
    }));
    
    console.log('[API] Approvers:', approvers);
    res.json(approvers);
  } catch (err) {
    console.error('[API] Error fetching approvers:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});



// Check if user exists in LdraUsers
app.post('/api/check-user', async (req, res) => {
  console.log('[API] POST /api/check-user called');
  const { email } = req.body;
  console.log('[API] Checking user:', email);
  
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_USERS_LIST}/items` +
      `?$expand=fields&$filter=fields/Email eq '${email}'`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly'
        } 
      }
    );
    
    if (response.data.value.length > 0) {
      const user = response.data.value[0];
      console.log('[API] User found:', user.fields);
      res.json({
        exists: true,
        userType: user.fields.UserType,
        isActive: user.fields.IsActive
      });
    } else {
      console.log('[API] User not found, will need auto-registration');
      res.json({ exists: false });
    }
  } catch (err) {
    console.error('[API] Error checking user:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});



































// phase two 



// Add this at the top with other requires
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });




 
app.post('/api/upload-document', upload.single('file'), async (req, res) => {
  console.log('[API] POST /api/upload-document called');
 
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
 
  try {
    const token = await getAccessToken();
   
    // ✅ FIX 1: Sanitize filename (remove spaces)
    const sanitizedName = req.file.originalname.replace(/\s+/g, '_');
    const fileName = `${Date.now()}_${sanitizedName}`;
   
    console.log('[API] Uploading file to LdraDocuments library:', fileName);
 
    // Use the specific LdraDocuments library drive ID
    const uploadUrl = `https://graph.microsoft.com/v1.0/drives/b!4664eif08ESwzBRvzkXczxs_8fKtHpdKpcKVQuVYVta2E1ctwdwMQbIWnp2PkDaN/root:/${fileName}:/content`;
   
    const uploadResponse = await axios.put(
      uploadUrl,
      req.file.buffer,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': req.file.mimetype,
        }
      }
    );
 
    // ✅ FIX 2: Construct permanent SharePoint path
    const permanentUrl = `https://m365x69937178.sharepoint.com/sites/LDRA/LdraDocuments/${fileName}`;
   
    console.log('[API] File uploaded successfully to LdraDocuments library');
    console.log('[API] webUrl (viewer):', uploadResponse.data.webUrl);
    console.log('[API] Permanent download URL:', permanentUrl);
    console.log('[API] Graph downloadUrl (temp):', uploadResponse.data['@microsoft.graph.downloadUrl']);
   
    res.json({
      fileId: uploadResponse.data.id,
      fileName: uploadResponse.data.name,
      fileUrl: permanentUrl  // ✅ CHANGED: Use permanent URL instead of webUrl
    });
  } catch (err) {
    console.error('[API] Upload error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});
 


















app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('[TEST] Testing connection to Microsoft Graph...');
    const token = await getAccessToken();
    console.log('[TEST] Token obtained successfully');
    
    const testResponse = await axios.get(
      'https://graph.microsoft.com/v1.0/me',
      { 
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000 // 10 second timeout
      }
    );
    
    res.json({ success: true, message: 'Connection working' });
  } catch (err) {
    console.error('[TEST] Connection failed:', err.message);
    res.status(500).json({ 
      error: err.message,
      code: err.code,
      timeout: err.code === 'ETIMEDOUT'
    });
  }
});



app.get('/api/debug-existing-request', async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items?$expand=fields&$top=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (response.data.value.length > 0) {
      res.json({
        sampleFields: response.data.value[0].fields
      });
    } else {
      res.json({ message: "No existing requests found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});









// Debug endpoint to check list fields
app.get('/api/debug-list-fields/:listId', async (req, res) => {
  console.log('[API] Debug list fields called');
  try {
    const token = await getAccessToken();
    const { listId } = req.params;
    
    // Get all columns for the list
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/columns`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // Find person/lookup fields
    const personFields = response.data.value.filter(col => 
      col.personOrGroup !== undefined || col.lookup !== undefined
    );
    
    // Get all fields for debugging
    const allFields = response.data.value.map(f => ({
      displayName: f.displayName,
      name: f.name,
      type: f.personOrGroup ? 'Person' : f.lookup ? 'Lookup' : f.text ? 'Text' : f.number ? 'Number' : 'Other',
      required: f.required,
      readOnly: f.readOnly
    }));
    
    res.json({
      totalFields: response.data.value.length,
      personFields: personFields.map(f => ({
        displayName: f.displayName,
        name: f.name,
        required: f.required,
        allowMultiple: f.personOrGroup?.allowMultipleSelection
      })),
      allFieldsSummary: allFields.filter(f => 
        ['Requester', 'AssignedApprover', 'RequesterId', 'AssignedApproverId'].some(
          name => f.displayName.includes(name) || f.name.includes(name)
        )
      )
    });
  } catch (err) {
    console.error('[API] Debug error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});













// Replace the debug-site-users endpoint with this:
app.get('/api/debug-site-users', async (req, res) => {
  console.log('[API] Debug site users called');
  try {
    const token = await getAccessToken();
    
    // Try different approaches to get user info
    const results = {};
    
    // Approach 1: Get from LdraUsers list
    try {
      const ldraUsersResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_USERS_LIST}/items?$expand=fields&$top=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      results.ldraUsers = ldraUsersResponse.data.value.map(item => ({
        id: item.id,
        title: item.fields.Title,
        email: item.fields.Email,
        userId: item.fields.UserId,
        userType: item.fields.UserType
      }));
    } catch (e) {
      results.ldraUsersError = e.message;
    }
    
    // Approach 2: Get current user via Graph
    try {
      const meResponse = await axios.get(
        'https://graph.microsoft.com/v1.0/me',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      results.currentUser = {
        id: meResponse.data.id,
        displayName: meResponse.data.displayName,
        mail: meResponse.data.mail
      };
    } catch (e) {
      // This will fail with app-only token
      results.currentUserNote = 'Not available with app-only authentication';
    }
    
    // Approach 3: Try to get a sample item from LdraRequests to see format
    try {
      const requestsResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items?$expand=fields&$top=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (requestsResponse.data.value.length > 0) {
        const fields = requestsResponse.data.value[0].fields;
        results.sampleRequestPersonFields = {
          requester: fields.Requester,
          requesterLookupId: fields.RequesterLookupId,
          assignedApprover: fields.AssignedApprover,
          assignedApproverLookupId: fields.AssignedApproverLookupId
        };
      }
    } catch (e) {
      results.sampleRequestError = e.message;
    }
    
    res.json(results);
  } catch (err) {
    console.error('[API] Debug error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});









// Add this to server.js to check LdraUsers list structure
app.get('/api/debug-ldrausers-fields', async (req, res) => {
  console.log('[API] Debug LdraUsers fields called');
  try {
    const token = await getAccessToken();
    
    // Get columns for LdraUsers list
    const columnsResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_USERS_LIST}/columns`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // Get sample data
    const itemsResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_USERS_LIST}/items?$expand=fields&$top=2`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const relevantColumns = columnsResponse.data.value
      .filter(col => ['Title', 'Email', 'UserId', 'UserType', 'IsActive'].includes(col.name))
      .map(col => ({
        name: col.name,
        displayName: col.displayName,
        type: col.text ? 'Text' : col.number ? 'Number' : col.boolean ? 'Boolean' : 'Other'
      }));
    
    const sampleData = itemsResponse.data.value.map(item => ({
      id: item.id,
      fields: {
        Title: item.fields.Title,
        Email: item.fields.Email,
        UserId: item.fields.UserId,
        UserType: item.fields.UserType,
        IsActive: item.fields.IsActive
      }
    }));
    
    res.json({
      columns: relevantColumns,
      sampleData: sampleData,
      note: "Check if UserId field exists and has SharePoint User IDs"
    });
    
  } catch (err) {
    console.error('[API] Debug error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});




app.get('/api/debug-request-fields', async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/columns`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const fields = response.data.value.map(col => ({
      name: col.name,
      displayName: col.displayName,
      type: col.text ? 'Text' : 
            col.number ? 'Number' : 
            col.choice ? 'Choice' : 
            col.boolean ? 'Boolean' :
            col.dateTime ? 'DateTime' :
            col.hyperlinkOrPicture ? 'Hyperlink' : 'Other',
      required: col.required,
      readOnly: col.readOnly
    }));
    
    res.json({
      totalFields: fields.length,
      requiredFields: fields.filter(f => f.required && !f.readOnly),
      allFields: fields
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});







// Add to server.js
app.get('/api/debug-choice-fields', async (req, res) => {
  try {
    const token = await getAccessToken();
    
    // Get detailed column info including choices
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/columns?$select=name,displayName,choice`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const choiceFields = response.data.value
      .filter(col => col.choice)
      .map(col => ({
        name: col.name,
        displayName: col.displayName,
        choices: col.choice.choices,
        allowFillIn: col.choice.allowFillInChoice
      }));
    
    res.json(choiceFields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});











// Add this to server.js for testing:
app.get('/api/debug-odata-fields', async (req, res) => {
  try {
    const token = await getAccessToken();
    
    console.log('[DEBUG] Testing different field names...');
    
    // Test 1: Try createdDateTime
    try {
      const test1 = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items?$top=1&$orderby=createdDateTime desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('[DEBUG] createdDateTime - SUCCESS');
    } catch (e) {
      console.log('[DEBUG] createdDateTime - FAILED:', e.response?.data?.error?.message);
    }
    
    // Test 2: Try Created
    try {
      const test2 = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items?$top=1&$orderby=Created desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('[DEBUG] Created - SUCCESS');
    } catch (e) {
      console.log('[DEBUG] Created - FAILED:', e.response?.data?.error?.message);
    }
    
    // Test 3: Try fields/Created
    try {
      const test3 = await axios.get(
        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items?$expand=fields&$top=1&$orderby=fields/Created desc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('[DEBUG] fields/Created - SUCCESS');
    } catch (e) {
      console.log('[DEBUG] fields/Created - FAILED:', e.response?.data?.error?.message);
    }
    
    res.json({ message: 'Check console for results' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




app.get('/api/debug-filelink-column', async (req, res) => {
  try {
    const token = await getAccessToken();
    
    const columnsResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/columns`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const allLinkColumns = columnsResponse.data.value
      .filter(col => col.displayName?.toLowerCase().includes('link') || col.name?.toLowerCase().includes('link'))
      .map(col => ({
        name: col.name,
        displayName: col.displayName,
        type: col.hyperlinkOrPicture ? 'Hyperlink' : 'Other',
        readOnly: col.readOnly
      }));
    
    res.json(allLinkColumns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});














app.get('/api/debug-filelink-full', async (req, res) => {
  try {
    const token = await getAccessToken();
    
    const columnsResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/columns`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const fileLink = columnsResponse.data.value.find(col => col.name === 'FileLink');
    
    res.json(fileLink);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});













app.post('/api/create-request', async (req, res) => {
  console.log('[API] POST /api/create-request called');
  const { userEmail, userName, ...requestData } = req.body;
  console.log('[API] Creating request for:', userEmail);
  console.log('[API] Request data received:', requestData);
  
  let createPayload = null;
  
  try {
    const token = await getAccessToken();
    
    // Check/register user in LdraUsers
    const userCheckResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_USERS_LIST}/items` +
      `?$expand=fields&$filter=fields/Email eq '${userEmail}'`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly'
        } 
      }
    );
    
    // Auto-register if user doesn't exist
    if (userCheckResponse.data.value.length === 0) {
      console.log('[API] Auto-registering new user');
      await axios.post(
        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_USERS_LIST}/items`,
        {
          fields: {
            Title: userName,
            Email: userEmail,
            UserType: 'REQUESTER',
            IsActive: true
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );
      console.log('[API] User registered successfully');
    } else {
      console.log('[API] User already exists');
    }
    
    // Get next request number
    console.log('[API] Getting existing requests for numbering...');
    const existingRequests = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items?$expand=fields&$top=50&$orderby=createdDateTime desc`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly'
        } 
      }
    );
    
    let nextNumber = 1;
    if (existingRequests.data.value.length > 0) {
      let maxNumber = 0;
      existingRequests.data.value.forEach(item => {
        const title = item.fields?.Title || '';
        if (title.startsWith('REQ-')) {
          const number = parseInt(title.split('-')[1]) || 0;
          if (number > maxNumber) {
            maxNumber = number;
          }
        }
      });
      nextNumber = maxNumber + 1;
    }
    
    const requestTitle = `REQ-${String(nextNumber).padStart(3, '0')}`;
    console.log('[API] Generated request title:', requestTitle);
    
    // Create payload with simple email fields
    createPayload = {
      fields: {
        Title: requestTitle,
        CustomerName: requestData.customerName,
        CustomerType: 'New Customer',
        DocumentType: requestData.documentType,
        OtherDocType: 'NA',
        Status: 'New',
        FileID: requestData.fileId,
        Remarks: requestData.remarks || '',
        FuturePotential: requestData.businessBackground,
        AIProcessed: false,
        LastStatusChange: new Date().toISOString(),
        VersionNumber: 1,
        RequesterEmail: userEmail,
        DocumentUrl: requestData.fileUrl
      }
    };
    
    console.log('[API] RequesterEmail:', userEmail);
    console.log('[API] DocumentUrl:', requestData.fileUrl);
    console.log('[API] Final payload:', JSON.stringify(createPayload, null, 2));

    // Create the request
    const createResponse = await axios.post(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items`,
      createPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    console.log('[API] Request created successfully:', requestTitle);
    res.json({
      success: true,
      requestId: createResponse.data.id,
      requestTitle: requestTitle
    });
    
  } catch (err) {
    console.error('[API] === DETAILED ERROR DEBUG ===');
    console.error('[API] Status Code:', err.response?.status);
    console.error('[API] Error Message:', err.response?.data?.error?.message);
    console.error('[API] Error Details:', JSON.stringify(err.response?.data, null, 2));
    console.error('[API] === PAYLOAD SENT ===');
    console.error(JSON.stringify(createPayload, null, 2));
    console.error('[API] === END DEBUG ===');
    
    res.status(500).json({ 
      error: err.response?.data?.error?.message || err.message 
    });
  }
});


// PUT /api/update-request/:requestTitle  — resubmit a Re-Progress request
app.put('/api/update-request/:requestTitle', async (req, res) => {
  const { requestTitle } = req.params;
  const { customerName, documentType, businessBackground, remarks, fileId, fileUrl } = req.body;
  console.log('[API] PUT /api/update-request/' + requestTitle);

  try {
    const token = await getAccessToken();

    // Find the list item by Title
    const findResp = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items` +
        `?$expand=fields&$filter=fields/Title eq '${requestTitle}'`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
        },
      }
    );

    if (!findResp.data.value.length) {
      return res.status(404).json({ error: `Request '${requestTitle}' not found` });
    }

    const itemId = findResp.data.value[0].id;

    // Build update payload — only include file fields if a new file was uploaded
    const fields = {
      CustomerName: customerName,
      DocumentType: documentType,
      FuturePotential: businessBackground,
      Remarks: remarks || '',
      Status: 'Pending',
      LastStatusChange: new Date().toISOString(),
    };

    if (fileId) fields.FileID = fileId;
    if (fileUrl) fields.DocumentUrl = fileUrl;

    await axios.patch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items/${itemId}/fields`,
      fields,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    console.log('[API] Request updated to Pending:', requestTitle);
    res.json({ success: true, requestTitle });
  } catch (err) {
    console.error('[API] Error updating request:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.error?.message || err.message,
    });
  }
});


app.get('/api/debug-library-drive', async (req, res) => {
  try {
    const token = await getAccessToken();
    
    // Get the LdraDocuments library drive info
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_DOCUMENTS_LIBRARY}/drive`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    res.json({
      libraryDriveId: response.data.id,
      libraryName: response.data.name,
      webUrl: response.data.webUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




app.get('/api/verify-file/:fileId', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { fileId } = req.params;
    
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/drive/items/${fileId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    res.json({
      fileExists: true,
      fileName: response.data.name,
      fileUrl: response.data.webUrl,
      downloadUrl: response.data['@microsoft.graph.downloadUrl']
    });
  } catch (err) {
    res.json({ fileExists: false, error: err.message });
  }
});

// ── My Requests Endpoint ──────────────────────────────────────────────────────

// GET /api/my-requests?email=<email>  →  LdraRequests where RequesterEmail = email
app.get('/api/my-requests', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'email query parameter is required' });
    }

    console.log('[API] GET /api/my-requests for:', email);

    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items` +
        `?$expand=fields&$filter=fields/RequesterEmail eq '${email}'`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
        },
      }
    );

    console.log(`[API] Found ${response.data.value.length} requests for ${email}`);

    // Sort newest-first in JS (avoids $orderby index requirement)
    const sorted = [...response.data.value].sort(
      (a, b) =>
        new Date(b.fields?.LastStatusChange || b.createdDateTime).getTime() -
        new Date(a.fields?.LastStatusChange || a.createdDateTime).getTime()
    );

    const requests = sorted.map((item) => {
      const f = item.fields || {};

      let approverHistory = [];
      try {
        if (f.ApproverComments) {
          const parsed = JSON.parse(f.ApproverComments);
          if (Array.isArray(parsed)) approverHistory = parsed;
        }
      } catch (e) { /* ignore */ }

      return {
        id: item.id,
        title: f.Title || '',
        customerName: f.CustomerName || '',
        customerType: f.CustomerType || '',
        opportunityValue: f.OpportunityValue || 0,
        priority: f.Priority || '',
        documentType: f.DocumentType || '',
        otherDocType: f.OtherDocType || '',
        status: f.Status || 'New',
        requesterEmail: f.RequesterEmail || '',
        assignedApproverEmail: f.AssignedApproverEmail || '',
        reviewerEmail: '',
        reviewerName: '',
        documentUrl: f.DocumentUrl || '',
        fileId: f.FileID || '',
        remarks: f.Remarks || '',
        futurePotential: f.FuturePotential || '',
        approverComments: f.ApproverComments || '',
        approverHistory,
        versionNumber: f.VersionNumber || 1,
        lastStatusChange: f.LastStatusChange || item.lastModifiedDateTime || '',
      };
    });

    res.json(requests);
  } catch (err) {
    console.error('[API] Error fetching my requests:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

// ── Request Detail Endpoints ──────────────────────────────────────────────────

const WORKFLOW_HISTORY_LIST = 'WorkflowHistory';

// GET /api/request/:requestTitle  →  fetch single LdraRequest by Title (e.g. REQ-001)
app.get('/api/request/:requestTitle', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { requestTitle } = req.params;

    // Use plain $expand=fields to guarantee ALL custom columns are returned.
    // Nested $expand can silently drop non-expanded columns in some tenants.
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items` +
        `?$expand=fields&$filter=fields/Title eq '${requestTitle}'`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
        },
      }
    );

    if (!response.data.value.length) {
      return res.status(404).json({ error: `Request '${requestTitle}' not found` });
    }

    const item = response.data.value[0];
    const f = item.fields;

    console.log('[API] /request fields available:', Object.keys(f));
    console.log('[API] AssignedApprover:', f.AssignedApprover);
    console.log('[API] AssignedApproverEmail:', f.AssignedApproverEmail);
    console.log('[API] ApproverComments (raw):', f.ApproverComments);

    // ── Resolve reviewer identity ─────────────────────────────────────────────
    // Priority order:
    //   1. ApproverComments JSON → approver (most up-to-date — set on every review action)
    //   2. AssignedApproverEmail plain-text (set at request creation)
    //   3. AssignedApprover Person field (may be a string or object from Graph API)
    let reviewerEmail = '';
    let reviewerName  = '';

    // 3. AssignedApprover Person field (lowest priority for email)
    if (f.AssignedApprover) {
      if (typeof f.AssignedApprover === 'object') {
        reviewerEmail = f.AssignedApprover.email       || '';
        reviewerName  = f.AssignedApprover.displayName || f.AssignedApprover.title || '';
      } else if (typeof f.AssignedApprover === 'string') {
        // Without nested expand Graph returns display name as a string
        reviewerName = f.AssignedApprover;
      }
    }

    // 2. Plain-text email field
    if (!reviewerEmail && f.AssignedApproverEmail) {
      reviewerEmail = f.AssignedApproverEmail;
    }

    // ── Parse ApproverComments JSON ───────────────────────────────────────────
    // Format: [{ version, status, comment, approver, timestamp }, ...]
    // This is the AUTHORITATIVE source — always wins for reviewer email.
    let approverHistory = [];
    try {
      if (f.ApproverComments) {
        const parsed = JSON.parse(f.ApproverComments);
        if (Array.isArray(parsed) && parsed.length > 0) {
          approverHistory = parsed;
          // Latest entry has the most recent reviewer
          const latest = parsed[parsed.length - 1];
          if (latest?.approver) {
            reviewerEmail = latest.approver; // always override — most reliable
            console.log('[API] Reviewer resolved from ApproverComments:', reviewerEmail);
          }
        }
      }
    } catch (e) {
      console.error('[API] ApproverComments JSON parse error:', e.message, '| raw:', f.ApproverComments);
    }

    console.log('[API] Final reviewerEmail:', reviewerEmail, '| reviewerName:', reviewerName);
    // ─────────────────────────────────────────────────────────────────────────

    res.json({
      id: item.id,
      title: f.Title || '',
      customerName: f.CustomerName || '',
      customerType: f.CustomerType || '',
      opportunityValue: f.OpportunityValue || 0,
      priority: f.Priority || '',
      documentType: f.DocumentType || '',
      otherDocType: f.OtherDocType || '',
      status: f.Status || 'New',
      requesterEmail: f.RequesterEmail || '',
      assignedApproverEmail: f.AssignedApproverEmail || '',
      reviewerEmail,
      reviewerName,
      documentUrl: f.DocumentUrl || '',
      fileId: f.FileID || '',
      remarks: f.Remarks || '',
      futurePotential: f.FuturePotential || '',
      approverComments: f.ApproverComments || '',
      approverHistory,
      versionNumber: f.VersionNumber || 1,
      lastStatusChange: f.LastStatusChange || item.lastModifiedDateTime || '',
    });
  } catch (err) {
    console.error('[API] Error fetching request:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

// GET /api/workflow-history/:requestTitle  →  WorkflowHistory items for a request
app.get('/api/workflow-history/:requestTitle', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { requestTitle } = req.params;

    // Step 1: resolve the request's numeric SharePoint item ID
    const reqResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_REQUESTS_LIST}/items` +
        `?$expand=fields&$filter=fields/Title eq '${requestTitle}'`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
        },
      }
    );

    if (!reqResponse.data.value.length) {
      return res.json([]);
    }

    const requestNumericId = parseInt(reqResponse.data.value[0].id, 10);

    // Step 2: fetch WorkflowHistory filtered by the lookup to this request.
    // Use plain $expand=fields — nested $expand causes OData errors for Person columns
    // ("Could not find a property named 'Actor' on type 'microsoft.graph.fieldValueSet'").
    const histResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${WORKFLOW_HISTORY_LIST}/items` +
        `?$expand=fields&$filter=fields/RequestId eq ${requestNumericId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
        },
      }
    );

    // Sort ascending by ActionDate in JavaScript (avoids $orderby index requirement)
    const sorted = [...histResponse.data.value].sort(
      (a, b) =>
        new Date(a.fields?.ActionDate || a.createdDateTime).getTime() -
        new Date(b.fields?.ActionDate || b.createdDateTime).getTime()
    );

    const history = sorted.map((item) => {
      const f = item.fields || {};
      // With plain $expand=fields, Actor may be returned as a display-name string or
      // as an object depending on the Graph API version and tenant configuration.
      let actorName  = '';
      let actorEmail = '';
      if (f.Actor && typeof f.Actor === 'object') {
        actorName  = f.Actor.displayName || f.Actor.title || '';
        actorEmail = f.Actor.email       || '';
      } else if (typeof f.Actor === 'string') {
        actorName = f.Actor;
      }
      // Also check ActorEmail plain-text fallback if present
      if (!actorEmail && f.ActorEmail) {
        actorEmail = f.ActorEmail;
      }
      return {
        id: item.id,
        title: f.Title || '',
        fromStatus: f.FromStatus || '',
        toStatus: f.ToStatus || '',
        actorName,
        actorEmail,
        actionDate: f.ActionDate || item.createdDateTime || '',
        comments: f.Comments || '',
      };
    });

    res.json(history);
  } catch (err) {
    console.error('[API] Error fetching workflow history:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

app.get('/api/debug-ldrausers-all', async (req, res) => {
  try {
    const token = await getAccessToken();
    
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LDRA_USERS_LIST}/items?$expand=fields&$top=10`,
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly'
        } 
      }
    );
    
    const users = response.data.value.map(item => ({
      id: item.id,
      title: item.fields.Title,
      email: item.fields.Email,
      userType: item.fields.UserType,
      isActive: item.fields.IsActive,
      userId: item.fields.UserId
    }));
    
    res.json({
      totalUsers: response.data.value.length,
      users: users,
      approversOnly: users.filter(u => u.userType === 'APPROVER'),
      activeApprovers: users.filter(u => u.userType === 'APPROVER' && u.isActive === true)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In production: serve React for any non-API route (client-side routing)
// MUST be registered AFTER all /api/* routes
if (IS_PROD) {
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}