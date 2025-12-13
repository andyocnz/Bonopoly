/**
 * Main App Component
 *
 * Sets up routing, providers, and authentication
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import CreateGamePage from './pages/CreateGamePage';
import CreateTeamsPage from './pages/CreateTeamsPage';

// Theme configuration
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

// Protected route wrapper
function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: 'educator' | 'team';
}) {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Temporary placeholder dashboards
function EducatorDashboard() {
  const { game, logout } = useAuth();
  return (
    <div style={{ padding: '20px' }}>
      <h1>Educator Dashboard</h1>
      <p>Game: {game?.name}</p>
      <p>Game Code: {game?.game_code}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function TeamDashboard() {
  const { game, team, logout } = useAuth();
  return (
    <div style={{ padding: '20px' }}>
      <h1>Team Dashboard</h1>
      <p>Team: {team?.team_name}</p>
      <p>Game: {game?.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}


function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Educator routes */}
              <Route
                path="/educator/dashboard"
                element={
                  <ProtectedRoute requiredRole="educator">
                    <EducatorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/educator/create-game"
                element={<CreateGamePage />}
              />
              <Route
                path="/educator/create-teams"
                element={
                  <ProtectedRoute requiredRole="educator">
                    <CreateTeamsPage />
                  </ProtectedRoute>
                }
              />

              {/* Team routes */}
              <Route
                path="/team/dashboard"
                element={
                  <ProtectedRoute requiredRole="team">
                    <TeamDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
