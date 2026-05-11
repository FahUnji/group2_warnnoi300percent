import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ConnectionPage from './pages/ConnectionPage';
import DashboardPage from './pages/DashboardPage';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';

const API_BASE = 'http://localhost:8000';

function App() {
  // 'checking' | 'connected' | 'disconnected'
  const [verifyStatus, setVerifyStatus] = useState('checking');
  const [savedError, setSavedError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // D-14: On app load, verify saved credentials
    fetch(`${API_BASE}/api/jira/status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setVerifyStatus('connected');
          navigate('/dashboard', { replace: true });
        } else {
          // Pass non-"not_configured" errors to ConnectionPage as initial inline error
          if (data.error && data.error !== 'not_configured') {
            setSavedError(data);
          }
          setVerifyStatus('disconnected');
        }
      })
      .catch(() => {
        setVerifyStatus('disconnected');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (verifyStatus === 'checking') {
    // Full-screen loading while startup verify runs
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#ffffff',
        }}
      >
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<ConnectionPage initialError={savedError} apiBase={API_BASE} />}
      />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
