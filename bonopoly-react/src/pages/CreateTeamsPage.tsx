/**
 * Team Creation Page
 *
 * Allows educators to create teams for their game
 * - Automatically generates unique team PINs
 * - Shows all created teams with their PINs
 * - Educators can create teams one by one or in bulk
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ArrowBack, Add, ContentCopy, Delete, CheckCircle } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { generateUniqueTeamPin, writeSheet, readSheet } from '@/services/googleSheetsApi';
import { SHEET_NAMES } from '@/config/googleSheets';

interface TeamData {
  game_code: string;
  team_id: number;
  team_name: string;
  team_pin: string;
  email?: string;
}

export default function CreateTeamsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { game } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  const [teamName, setTeamName] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get game credentials from navigation state or auth context
  const gameCredentials = location.state?.gameCredentials;
  const currentGame = game;

  useEffect(() => {
    if (!currentGame && !gameCredentials) {
      showError('No game found. Please create a game first.');
      navigate('/educator/create-game');
      return;
    }

    // Load existing teams
    loadTeams();
  }, [currentGame, gameCredentials]);

  const loadTeams = async () => {
    if (!currentGame) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await readSheet(SHEET_NAMES.TEAMS, { game_code: currentGame.game_code });
      if (response.success && response.data) {
        // Normalize team data
        const normalizedTeams = response.data.map((team: any) => ({
          game_code: team.game_code || team.gameCode,
          team_id: Number(team.team_id || team.teamId),
          team_name: team.team_name || team.teamName,
          team_pin: String(team.team_pin || team.teamPin),
          email: team.email,
        }));
        setTeams(normalizedTeams);
      }
    } catch (error) {
      showError('Failed to load teams', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      showError('Please enter a team name');
      return;
    }

    if (!currentGame) {
      showError('No game found');
      return;
    }

    setIsCreating(true);

    try {
      // Generate unique team PIN for this game
      const teamPin = await generateUniqueTeamPin(currentGame.game_code);

      // Calculate next team ID
      const nextTeamId = teams.length > 0
        ? Math.max(...teams.map(t => t.team_id)) + 1
        : 1;

      const newTeam: TeamData = {
        game_code: currentGame.game_code,
        team_id: nextTeamId,
        team_name: teamName.trim(),
        team_pin: teamPin,
        email: teamEmail.trim() || undefined,
      };

      // Save to database
      const response = await writeSheet(SHEET_NAMES.TEAMS, newTeam);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create team');
      }

      // Add to local state
      setTeams([...teams, newTeam]);

      showSuccess(`Team "${teamName}" created! PIN: ${teamPin}`);

      // Clear form
      setTeamName('');
      setTeamEmail('');

    } catch (error: any) {
      showError('Failed to create team', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkCreate = async () => {
    if (!currentGame) {
      showError('No game found');
      return;
    }

    const numTeams = currentGame.num_teams;
    const existingCount = teams.length;

    if (existingCount >= numTeams) {
      showInfo(`You already have ${existingCount} teams (max: ${numTeams})`);
      return;
    }

    const teamsToCreate = numTeams - existingCount;

    setIsCreating(true);

    try {
      const newTeams: TeamData[] = [];

      for (let i = 0; i < teamsToCreate; i++) {
        const teamPin = await generateUniqueTeamPin(currentGame.game_code);
        const teamId = existingCount + i + 1;

        const team: TeamData = {
          game_code: currentGame.game_code,
          team_id: teamId,
          team_name: `Team ${teamId}`,
          team_pin: teamPin,
        };

        const response = await writeSheet(SHEET_NAMES.TEAMS, team);

        if (response.success) {
          newTeams.push(team);
        }
      }

      setTeams([...teams, ...newTeams]);
      showSuccess(`Created ${newTeams.length} teams!`);

    } catch (error: any) {
      showError('Failed to create teams', error);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showSuccess(`${label} copied!`);
  };

  const copyAllTeams = () => {
    const text = teams
      .map(t => `${t.team_name}: ${t.team_pin}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    showSuccess('All team credentials copied!');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 4,
      }}
    >
      <Container maxWidth="lg">
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
              padding: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                sx={{ color: 'white' }}
                onClick={() => navigate('/educator/dashboard')}
              >
                <ArrowBack />
              </IconButton>
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  Create Teams
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                  {currentGame ? `Game: ${currentGame.name} (${currentGame.game_code})` : 'Set up teams for your game'}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ p: 4 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Team Creation Form */}
                <Card sx={{ mb: 3, border: 2, borderColor: 'primary.main' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Add New Team
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Team Name"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          placeholder="e.g., Team Alpha"
                          disabled={isCreating}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Team Email (Optional)"
                          type="email"
                          value={teamEmail}
                          onChange={(e) => setTeamEmail(e.target.value)}
                          placeholder="team@university.edu"
                          disabled={isCreating}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Button
                          variant="contained"
                          startIcon={isCreating ? <CircularProgress size={20} /> : <Add />}
                          onClick={handleCreateTeam}
                          disabled={isCreating || !teamName.trim()}
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            mr: 2,
                          }}
                        >
                          Create Team
                        </Button>
                        {currentGame && teams.length < currentGame.num_teams && (
                          <Button
                            variant="outlined"
                            onClick={handleBulkCreate}
                            disabled={isCreating}
                          >
                            Create Remaining Teams ({currentGame.num_teams - teams.length} left)
                          </Button>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                <Divider sx={{ my: 3 }} />

                {/* Teams List */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Teams ({teams.length}
                      {currentGame ? `/${currentGame.num_teams}` : ''})
                    </Typography>
                    {teams.length > 0 && (
                      <Button
                        startIcon={<ContentCopy />}
                        onClick={copyAllTeams}
                        size="small"
                      >
                        Copy All
                      </Button>
                    )}
                  </Box>

                  {teams.length === 0 ? (
                    <Alert severity="info">
                      No teams created yet. Add your first team above!
                    </Alert>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Team ID</strong></TableCell>
                            <TableCell><strong>Team Name</strong></TableCell>
                            <TableCell><strong>Team PIN</strong></TableCell>
                            <TableCell><strong>Email</strong></TableCell>
                            <TableCell align="right"><strong>Actions</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {teams.map((team) => (
                            <TableRow key={team.team_id}>
                              <TableCell>{team.team_id}</TableCell>
                              <TableCell>{team.team_name}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography
                                    variant="body1"
                                    fontFamily="monospace"
                                    fontWeight={700}
                                  >
                                    {team.team_pin}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={() => copyToClipboard(team.team_pin, 'Team PIN')}
                                  >
                                    <ContentCopy fontSize="small" />
                                  </IconButton>
                                </Box>
                              </TableCell>
                              <TableCell>{team.email || '-'}</TableCell>
                              <TableCell align="right">
                                <IconButton size="small" color="success">
                                  <CheckCircle />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>

                {/* Action Buttons */}
                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/educator/dashboard')}
                  >
                    Back to Dashboard
                  </Button>
                  {teams.length > 0 && (
                    <Button
                      variant="contained"
                      onClick={() => navigate('/login')}
                      sx={{
                        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                      }}
                    >
                      Done - Go to Login
                    </Button>
                  )}
                </Box>
              </>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
