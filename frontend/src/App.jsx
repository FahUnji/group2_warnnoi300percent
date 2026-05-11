import { Routes, Route, Navigate } from 'react-router-dom';
import ConnectionPage from './pages/ConnectionPage';
import DashboardPage from './pages/DashboardPage';
import NoProjectPage from './pages/NoProjectPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ConnectionPage />} />
      <Route path="/no-project" element={<NoProjectPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
