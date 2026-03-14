import React from 'react';
import ReactDOM from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import './index.css';
import App from './App';
import { msalInstance } from './auth/msalConfig';
import reportWebVitals from './reportWebVitals';

// MsalProvider automatically calls initialize() and handleRedirectPromise()
// before rendering children, so no manual bootstrap is needed.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>
);

reportWebVitals();
