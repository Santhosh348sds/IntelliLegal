import React from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';
import welcomeImg from '../assets/Welcome.png';

const Login: React.FC = () => {
  const { instance } = useMsal();

  function handleSignIn() {
    instance.loginRedirect(loginRequest).catch((err: unknown) => {
      console.error('Sign-in redirect failed:', err);
    });
  }

  return (
    <div style={styles.page}>
      {/* ── Left panel ── */}
      <div style={styles.leftPanel}>
        <img src={welcomeImg} alt="Welcome to IntelliLegal" style={styles.welcomeImg} />
      </div>

      {/* ── Right panel ── */}
      <div style={styles.rightPanel}>
        <div style={styles.card}>
          {/* Logo */}
          <div style={styles.logoRow}>
            {/* <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L4 10v12c0 10.5 7.7 20.3 18 22.6C32.3 42.3 40 32.5 40 22V10L22 2z" fill="#1a6b5a"/>
              <path d="M22 2L4 10v12c0 10.5 7.7 20.3 18 22.6C32.3 42.3 40 32.5 40 22V10L22 2z" fill="url(#shieldGrad)"/>
              <defs>
                <linearGradient id="shieldGrad" x1="4" y1="2" x2="40" y2="44" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2d9cdb"/>
                  <stop offset="100%" stopColor="#1a6b5a"/>
                </linearGradient>
              </defs>
              <path d="M15 22l5 5 9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="22" cy="15" r="3" fill="#fff" fillOpacity="0.3"/>
            </svg> */}
            <img src={require('../assets/IntelliLegal Logo.png')} style={{ height: '50px', width: 'auto' }} />
            <span style={styles.brandText}>
              Intelli<span style={styles.brandAccent}>Legal</span>
            </span>
          </div>

          {/* Invite text */}
          <p style={styles.inviteText}>
            You've been invited to submit your legal documents for review
          </p>

          {/* Get Started button */}
          <button style={styles.getStartedBtn} onClick={handleSignIn}>
            Get Started &nbsp;→
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    overflow: 'hidden',
  }, 

  /* ── Left ── */
  leftPanel: {
    flex: '0 0 50%', 
    display: 'flex',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  welcomeImg: {
    width: '100%',
    height: '100vh',
    objectFit: 'cover',
    objectPosition: 'center',
    display: 'block',
  },

  /* ── Right ── */
  rightPanel: {
    flex: '0 0 50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f4f6f3',
    padding: '40px 24px',
  },
  card: {
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 2px 24px rgba(0,0,0,0.08)',
    padding: '56px 48px',
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 0,
  },

  /* Logo row */
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },
  brandText: {
    fontSize: 26,
    fontWeight: 700,
    color: '#1a1a1a',
    letterSpacing: '-0.3px',
  },
  brandAccent: {
    color: '#1a9b70',
  },

  /* Invite copy */
  inviteText: {
    fontSize: 16,
    color: '#444',
    lineHeight: 1.6,
    margin: '0 0 36px',
    maxWidth: 280,
  },

  /* CTA button */
  getStartedBtn: {
    width: '100%',
    padding: '14px 24px',
    fontSize: 16,
    fontWeight: 600,
    background: '#1a6b5a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.2px',
    transition: 'background 0.2s',
  },
};

export default Login;
