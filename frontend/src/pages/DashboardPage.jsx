import { useState, useEffect } from 'react';

function DashboardPage() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
  });

  useEffect(() => {
    if (user) return;
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.user) {
          sessionStorage.setItem('jira_user', JSON.stringify(data.user));
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '48px', fontFamily: 'Inter, sans-serif', color: '#414944' }}>
      <h1 style={{ color: '#002d1c', marginBottom: '16px' }}>Dashboard</h1>
      {user ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '12px',
          background: '#f0f7f4', border: '1px solid #c1e0d5',
          borderRadius: '10px', padding: '12px 18px', marginBottom: '24px',
        }}>
          {user.avatar && (
            <img src={user.avatar} alt="" width={36} height={36}
              style={{ borderRadius: '50%', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontWeight: 600, color: '#002d1c', fontSize: '15px' }}>{user.name}</div>
            <div style={{ fontSize: '13px', color: '#5a7a6a' }}>{user.email}</div>
          </div>
          <div style={{
            marginLeft: '8px', fontSize: '12px', color: '#1b7a4a',
            background: '#d1fae5', borderRadius: '6px', padding: '3px 10px', fontWeight: 500,
          }}>
            Connected
          </div>
        </div>
      ) : (
        <p style={{ marginBottom: '24px', color: '#8b9196' }}>Connecting to Jira…</p>
      )}
      <p>Bug summary dashboard — coming in Phase 3.</p>
    </div>
  );
}

export default DashboardPage;
