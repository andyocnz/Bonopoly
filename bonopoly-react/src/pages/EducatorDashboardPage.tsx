/**
 * Educator Dashboard
 *
 * Main dashboard for educators to manage their game:
 * - Game overview and settings
 * - Round management
 * - Team monitoring (see who submitted)
 * - View all results
 * - Update game settings
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Logout,
  Refresh,
  Settings,
  People,
  Assessment,
  PlayArrow,
  Stop,
  CheckCircle,
  Cancel,
  Edit,
  Download,
  BugReport,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { readSheet, updateSheet } from '@/services/googleSheetsApi';
import { SHEET_NAMES } from '@/config/googleSheets';

interface TeamSubmission {
  team_id: number;
  team_name: string;
  submitted: boolean;
  timestamp?: string;
}

export default function EducatorDashboardPage() {
  const { game, logout } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  const [activeTab, setActiveTab] = useState(0);
  const [teams, setTeams] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [roundScenarios, setRoundScenarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [devMode, setDevMode] = useState(false);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editedGame, setEditedGame] = useState(game);

  // Load all data
  const loadData = async () => {
    if (!game) return;

    setLoading(true);
    try {
      // Load teams
      const teamsResponse = await readSheet(SHEET_NAMES.TEAMS, { game_code: game.game_code });
      if (teamsResponse.success) {
        setTeams(teamsResponse.data || []);
      }

      // Load decisions for current round
      const decisionsResponse = await readSheet(SHEET_NAMES.DECISIONS, {
        game_code: game.game_code,
        round: game.current_round,
      });
      if (decisionsResponse.success) {
        setDecisions(decisionsResponse.data || []);
      }

      // Load outputs for current round
      const outputsResponse = await readSheet(SHEET_NAMES.OUTPUTS, {
        game_code: game.game_code,
        round: game.current_round,
      });
      if (outputsResponse.success) {
        setOutputs(outputsResponse.data || []);
      }

      // Load round scenarios
      const scenariosResponse = await readSheet(SHEET_NAMES.ROUND_SCENARIOS, {
        game_code: game.game_code,
      });
      if (scenariosResponse.success) {
        setRoundScenarios(scenariosResponse.data || []);
      }

      showSuccess('Data refreshed');
    } catch (error: any) {
      showError('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [game?.current_round]);

  // Get team submission status
  const getTeamSubmissions = (): TeamSubmission[] => {
    return teams.map((team) => {
      const decision = decisions.find(
        (d) => d.team_id === team.team_id || d.teamId === team.team_id
      );
      return {
        team_id: team.team_id,
        team_name: team.team_name,
        submitted: decision?.submitted || false,
        timestamp: decision?.timestamp,
      };
    });
  };

  // Update game settings
  const handleUpdateSettings = async () => {
    if (!editedGame) return;

    try {
      const updateResponse = await updateSheet(
        SHEET_NAMES.GAME,
        { game_code: game?.game_code },
        {
          current_round: editedGame.current_round,
          status: editedGame.status,
          num_rounds: editedGame.num_rounds,
        }
      );

      if (updateResponse.success) {
        showSuccess('Game settings updated');
        setSettingsOpen(false);
        loadData();
      } else {
        showError('Failed to update settings', updateResponse.error);
      }
    } catch (error: any) {
      showError('Failed to update settings', error);
    }
  };

  if (!game) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>No game loaded. Please log in.</Typography>
        <Button onClick={logout} sx={{ mt: 2 }}>
          Back to Login
        </Button>
      </Box>
    );
  }

  const teamSubmissions = getTeamSubmissions();
  const submittedCount = teamSubmissions.filter((t) => t.submitted).length;
  const currentScenario = roundScenarios.find((s) => s.round === game.current_round);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa' }}>
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          p: 3,
          boxShadow: 3,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4" fontWeight={700}>
                {game.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
                <Chip
                  label={`Game Code: ${game.game_code}`}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
                />
                <Chip
                  label={`Round ${game.current_round}/${game.num_rounds}`}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600 }}
                />
                <Chip
                  label={game.status}
                  sx={{
                    bgcolor: game.status === 'active' ? '#4caf50' : '#ff9800',
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Refresh Data">
                <IconButton onClick={loadData} sx={{ color: 'white' }}>
                  {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : <Refresh />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Game Settings">
                <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'white' }}>
                  <Settings />
                </IconButton>
              </Tooltip>
              <Button
                startIcon={<Logout />}
                onClick={logout}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                }}
              >
                Logout
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Dev Mode Toggle */}
      <Container maxWidth="lg" sx={{ mt: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={devMode}
              onChange={(e) => setDevMode(e.target.checked)}
              color="warning"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BugReport fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                Dev Mode (Override Visibility Rules)
              </Typography>
            </Box>
          }
        />
      </Container>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 2, pb: 4 }}>
        <Paper sx={{ borderRadius: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab label="Overview" icon={<Assessment />} iconPosition="start" />
            <Tab label="Team Status" icon={<People />} iconPosition="start" />
            <Tab label="Results" icon={<Assessment />} iconPosition="start" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* Tab 0: Overview */}
            {activeTab === 0 && (
              <Grid container spacing={3}>
                {/* Stats Cards */}
                <Grid item xs={12} md={3}>
                  <Card sx={{ bgcolor: '#e3f2fd' }}>
                    <CardContent>
                      <Typography variant="h4" fontWeight={700}>
                        {teams.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Teams
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ bgcolor: '#e8f5e9' }}>
                    <CardContent>
                      <Typography variant="h4" fontWeight={700}>
                        {submittedCount}/{teams.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Submissions (R{game.current_round})
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ bgcolor: '#fff3e0' }}>
                    <CardContent>
                      <Typography variant="h4" fontWeight={700}>
                        {game.current_round}/{game.num_rounds}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Current Round
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ bgcolor: '#f3e5f5' }}>
                    <CardContent>
                      <Typography variant="h4" fontWeight={700}>
                        {game.template}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Difficulty
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Current Round Scenario */}
                {currentScenario && (
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                          Round {game.current_round} Scenarios
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={4}>
                            <Typography variant="body2" color="text.secondary">
                              US
                            </Typography>
                            <Chip label={`Scenario ${currentScenario.us_scenario_id}`} color="primary" />
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="body2" color="text.secondary">
                              Asia
                            </Typography>
                            <Chip label={`Scenario ${currentScenario.asia_scenario_id}`} color="primary" />
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="body2" color="text.secondary">
                              Europe
                            </Typography>
                            <Chip label={`Scenario ${currentScenario.europe_scenario_id}`} color="primary" />
                          </Grid>
                        </Grid>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                          Deadline: {new Date(currentScenario.deadline).toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Game Info */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" fontWeight={600} gutterBottom>
                        Game Information
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Educator Email
                          </Typography>
                          <Typography variant="body1">{game.educator_email}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Timezone
                          </Typography>
                          <Typography variant="body1">{game.timezone}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Hours per Round
                          </Typography>
                          <Typography variant="body1">{game.hours_per_round}h</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Started
                          </Typography>
                          <Typography variant="body1">
                            {new Date(game.start_time).toLocaleDateString()}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Tab 1: Team Status */}
            {activeTab === 1 && (
              <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Team Submission Status - Round {game.current_round}
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Team ID</TableCell>
                        <TableCell>Team Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Submitted At</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {teamSubmissions.map((team) => (
                        <TableRow key={team.team_id}>
                          <TableCell>{team.team_id}</TableCell>
                          <TableCell fontWeight={600}>{team.team_name}</TableCell>
                          <TableCell>
                            {team.submitted ? (
                              <Chip
                                icon={<CheckCircle />}
                                label="Submitted"
                                color="success"
                                size="small"
                              />
                            ) : (
                              <Chip
                                icon={<Cancel />}
                                label="Pending"
                                color="warning"
                                size="small"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {team.timestamp
                              ? new Date(team.timestamp).toLocaleString()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Button size="small" disabled={!team.submitted}>
                              View Decision
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {submittedCount === teams.length && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    All teams have submitted their decisions for Round {game.current_round}!
                  </Alert>
                )}
              </Box>
            )}

            {/* Tab 2: Results */}
            {activeTab === 2 && (
              <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Round {game.current_round} Results
                </Typography>

                {devMode ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <strong>Dev Mode Active:</strong> Showing results regardless of deadline
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Results will be visible after the round deadline passes
                  </Alert>
                )}

                {outputs.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Team</TableCell>
                          <TableCell align="right">Revenue</TableCell>
                          <TableCell align="right">Costs</TableCell>
                          <TableCell align="right">Profit</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {outputs.map((output) => {
                          const team = teams.find((t) => t.team_id === output.team_id);
                          return (
                            <TableRow key={output.team_id}>
                              <TableCell>{team?.team_name || `Team ${output.team_id}`}</TableCell>
                              <TableCell align="right">
                                ${(output.total_revenue || 0).toLocaleString()}
                              </TableCell>
                              <TableCell align="right">
                                ${(output.total_costs || 0).toLocaleString()}
                              </TableCell>
                              <TableCell align="right">
                                <Typography
                                  color={output.profit_after_tax >= 0 ? 'success.main' : 'error.main'}
                                  fontWeight={600}
                                >
                                  ${(output.profit_after_tax || 0).toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Button size="small">View Details</Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">
                    No results available yet. Results will be calculated after all teams submit
                    their decisions.
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        </Paper>
      </Container>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Game Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Current Round"
              type="number"
              value={editedGame?.current_round || 1}
              onChange={(e) =>
                setEditedGame((prev) => ({
                  ...prev!,
                  current_round: parseInt(e.target.value),
                }))
              }
              inputProps={{ min: 1, max: game.num_rounds }}
              fullWidth
            />
            <TextField
              label="Status"
              select
              value={editedGame?.status || 'active'}
              onChange={(e) =>
                setEditedGame((prev) => ({ ...prev!, status: e.target.value }))
              }
              fullWidth
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </TextField>
            <TextField
              label="Total Rounds"
              type="number"
              value={editedGame?.num_rounds || 3}
              onChange={(e) =>
                setEditedGame((prev) => ({
                  ...prev!,
                  num_rounds: parseInt(e.target.value),
                }))
              }
              inputProps={{ min: 3, max: 10 }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateSettings}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
