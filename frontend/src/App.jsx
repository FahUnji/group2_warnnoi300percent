import { Routes, Route, Navigate } from 'react-router-dom';
import ConnectionPage from './pages/ConnectionPage';
import DashboardPage from './pages/DashboardPage';
import BugReportPage from './pages/BugReportPage';
import SprintPage from './pages/SprintPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ConnectionPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/bug-report" element={<BugReportPage />} />
      <Route path="/sprint" element={<SprintPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
