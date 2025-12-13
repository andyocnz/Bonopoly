/**
 * Login Page
 *
 * Simple authentication:
 * - Educator: game_code + game_pin
 * - Team: game_code + team_pin
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Typography,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { School, Group, Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'educator' | 'team'>('educator');
  const [gameCode, setGameCode] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { loginEducator, loginTeam } = useAuth();
  const navigate = useNavigate();

  // Pre-fill from URL query parameters
  useEffect(() => {
    const role = searchParams.get('role');
    const code = searchParams.get('code');
    const urlPin = searchParams.get('pin');

    if (role === 'educator' || role === 'team') {
      setActiveTab(role);
    }
    if (code) {
      setGameCode(code.toUpperCase());
    }
    if (urlPin) {
      setPin(urlPin);
    }
  }, [searchParams]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: 'educator' | 'team') => {
    setActiveTab(newValue);
    // Clear inputs when switching tabs
    setGameCode('');
    setPin('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gameCode || !pin) {
      return;
    }

    setIsLoading(true);

    try {
      let success = false;

      if (activeTab === 'educator') {
        success = await loginEducator(gameCode.toUpperCase(), pin);
      } else {
        success = await loginTeam(gameCode.toUpperCase(), pin);
      }

      if (success) {
        // Navigate to appropriate dashboard
        if (activeTab === 'educator') {
          navigate('/educator/dashboard');
        } else {
          navigate('/team/dashboard');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="h3" fontWeight={700} gutterBottom>
              Bonopoly
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Business Strategy Simulation Game
            </Typography>
          </Box>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Tab
              value="educator"
              label="Educator"
              icon={<School />}
              iconPosition="start"
            />
            <Tab
              value="team"
              label="Team"
              icon={<Group />}
              iconPosition="start"
            />
          </Tabs>

          {/* Login Form */}
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              padding: 4,
            }}
          >
            <Typography variant="h6" gutterBottom>
              {activeTab === 'educator' ? 'Educator Login' : 'Team Login'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your game code and{' '}
              {activeTab === 'educator' ? 'game PIN' : 'team PIN'} to continue
            </Typography>

            <TextField
              fullWidth
              label="Game Code"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="e.g., ABC123"
              inputProps={{ maxLength: 6 }}
              required
              disabled={isLoading}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label={activeTab === 'educator' ? 'Game PIN' : 'Team PIN'}
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="7-digit PIN"
              inputProps={{ maxLength: 7, pattern: '[0-9]*' }}
              required
              disabled={isLoading}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPin(!showPin)}
                      edge="end"
                      disabled={isLoading}
                    >
                      {showPin ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={isLoading || !gameCode || !pin}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                py: 1.5,
                fontWeight: 600,
                fontSize: '16px',
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                `Login as ${activeTab === 'educator' ? 'Educator' : 'Team'}`
              )}
            </Button>

            {activeTab === 'educator' && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Don't have a game yet?
                </Typography>
                <Button
                  onClick={() => navigate('/educator/create-game')}
                  sx={{ mt: 1 }}
                >
                  Create New Game
                </Button>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Dev Mode Indicator */}
        {import.meta.env.DEV && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 2,
              textAlign: 'center',
              color: 'white',
            }}
          >
            <Typography variant="caption">
              🛠️ Development Mode - All API calls logged to console
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
