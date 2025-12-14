/**
 * Game Creation Wizard
 *
 * 3-step wizard for educators to create new games:
 * 1. Basic Info (name, email, teams, rounds, template)
 * 2. Review & Confirm
 * 3. Success (show game_code and game_pin)
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Button,
  TextField,
  Typography,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import { Check, ContentCopy, ExpandMore, Share } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { generateUniqueGameCode, generateGamePin, generateUniqueTeamPin, writeSheet } from '@/services/googleSheetsApi';
import { SHEET_NAMES } from '@/config/googleSheets';
import { ProgressTerminal, type ProgressStep } from '@/components/ProgressTerminal';

const TIMEZONES = [
  // New Zealand
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Pacific/Wellington',
  // Australia
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  // Asia
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Dubai',
  // Europe
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  // Americas
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
];

const TEMPLATES = [
  {
    value: 'easy',
    label: 'Easy',
    description: 'Simplified parameters, ideal for beginners',
    details: [
      'Lower production capacity constraints',
      'Simplified market dynamics',
      'Fewer strategic variables to manage',
      'More forgiving financial models',
      'Basic supply chain complexity'
    ]
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Balanced complexity, recommended for MBA courses',
    details: [
      'Moderate production constraints',
      'Realistic market competition',
      'Standard HR and marketing parameters',
      'Balanced financial complexity',
      'Multi-region supply chains'
    ]
  },
  {
    value: 'hard',
    label: 'Hard',
    description: 'Full complexity, for advanced students',
    details: [
      'Strict capacity and resource limits',
      'Advanced competitive dynamics',
      'Complex stakeholder relationships',
      'Sophisticated financial models',
      'Global supply chain management'
    ]
  },
];

// Fun team name generators
const TEAM_NAMES = [
  // Animals
  'Lions', 'Eagles', 'Panthers', 'Wolves', 'Tigers', 'Dolphins', 'Hawks', 'Bears',
  // Fruits
  'Mangoes', 'Apples', 'Bananas', 'Oranges', 'Grapes', 'Kiwis', 'Berries', 'Peaches',
  // Colors
  'Crimson', 'Azure', 'Emerald', 'Golden', 'Silver', 'Violet', 'Indigo', 'Scarlet',
  // Elements
  'Phoenix', 'Thunder', 'Lightning', 'Storm', 'Blaze', 'Frost', 'Wave', 'Quake',
];

interface GameFormData {
  name: string;
  educator_email: string;
  num_teams: number;
  num_rounds: number;
  hours_per_round: number;
  timezone: string;
  template: string;
}

export default function CreateGamePage() {
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDebugParams, setShowDebugParams] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [formData, setFormData] = useState<GameFormData>({
    name: '',
    educator_email: '',
    num_teams: 5,
    num_rounds: 3,
    hours_per_round: 168, // 1 week
    timezone: 'Pacific/Auckland',
    template: 'medium',
  });
  const [gameCredentials, setGameCredentials] = useState<{
    game_code: string;
    game_pin: string;
    teams?: Array<{ team_id: number; team_name: string; team_pin: string; email: string }>;
  } | null>(null);

  const [teams, setTeams] = useState<Array<{
    team_name: string;
    email: string;
  }>>([]);

  const { showSuccess: showSuccessNotification, showError } = useNotification();
  const { loginEducator } = useAuth();
  const navigate = useNavigate();

  // Auto-generate fun team names when num_teams changes
  React.useEffect(() => {
    const newTeams = Array.from({ length: formData.num_teams }, (_, i) => {
      // Pick a random name from TEAM_NAMES array
      const randomName = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
      return {
        team_name: randomName,
        email: '',
      };
    });
    setTeams(newTeams);
  }, [formData.num_teams]);

  const handleChange = (field: keyof GameFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateTeam = (index: number, field: 'team_name' | 'email', value: string) => {
    const newTeams = [...teams];
    newTeams[index][field] = value;
    setTeams(newTeams);
  };

  const updateProgress = (stepId: string, status: 'running' | 'success' | 'error', message?: string) => {
    setProgressSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? { ...step, status, message, timestamp: Date.now() }
          : step
      )
    );
  };

  const handleCreateGame = async () => {
    setIsCreating(true);

    // Initialize progress steps
    const initialSteps: ProgressStep[] = [
      { id: 'init', label: 'Initializing game creation', status: 'pending' },
      { id: 'game', label: 'Creating game record', status: 'pending' },
      { id: 'teams', label: `Creating ${formData.num_teams} teams`, status: 'pending' },
      { id: 'scenarios', label: `Creating ${formData.num_rounds} round scenarios`, status: 'pending' },
      { id: 'complete', label: 'Finalizing setup', status: 'pending' },
    ];
    setProgressSteps(initialSteps);

    try {
      // Step 1: Generate unique game code and PIN
      updateProgress('init', 'running');
      const game_code = await generateUniqueGameCode();
      const game_pin = generateGamePin();
      updateProgress('init', 'success', `Game code: ${game_code}`);

      // Step 2: Create game in database
      updateProgress('game', 'running');
      const gameData = {
        game_code,
        game_pin,
        name: formData.name,
        educator_email: formData.educator_email,
        num_teams: formData.num_teams,
        num_rounds: formData.num_rounds,
        hours_per_round: formData.hours_per_round,
        start_time: new Date().toISOString(),
        timezone: formData.timezone,
        current_round: 1,
        template: formData.template,
        status: 'active',
      };

      const gameResponse = await writeSheet(SHEET_NAMES.GAME, gameData);

      if (!gameResponse.success) {
        updateProgress('game', 'error', gameResponse.error);
        throw new Error(gameResponse.error || 'Failed to create game');
      }
      updateProgress('game', 'success', formData.name);

      // Step 3: Create all teams
      updateProgress('teams', 'running');
      const createdTeams = [];
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        const team_pin = await generateUniqueTeamPin(game_code);

        const teamData = {
          game_code,
          team_id: i + 1,
          team_name: team.team_name,
          team_pin,
          email: team.email || '',
        };

        const teamResponse = await writeSheet(SHEET_NAMES.TEAMS, teamData);

        if (teamResponse.success) {
          createdTeams.push({ ...teamData, team_pin });
          updateProgress('teams', 'running', `${createdTeams.length}/${teams.length} teams created`);
        }
      }
      updateProgress('teams', 'success', `All ${createdTeams.length} teams created`);

      // Step 4: Create round scenarios
      updateProgress('scenarios', 'running');
      const startTime = new Date();
      for (let round = 1; round <= formData.num_rounds; round++) {
        const deadline = new Date(startTime);
        deadline.setHours(deadline.getHours() + (formData.hours_per_round * round));

        // Randomize scenario IDs for each country (1-8)
        const scenarioData = {
          game_code,
          round,
          deadline: deadline.toISOString(),
          us_scenario_id: Math.floor(Math.random() * 8) + 1,
          asia_scenario_id: Math.floor(Math.random() * 8) + 1,
          europe_scenario_id: Math.floor(Math.random() * 8) + 1,
        };

        await writeSheet(SHEET_NAMES.ROUND_SCENARIOS, scenarioData);
        updateProgress('scenarios', 'running', `Round ${round}/${formData.num_rounds} created`);
      }
      updateProgress('scenarios', 'success', `All ${formData.num_rounds} rounds configured`);

      // Step 5: Complete
      updateProgress('complete', 'running');
      setGameCredentials({ game_code, game_pin, teams: createdTeams });
      updateProgress('complete', 'success', 'Game ready!');

      showSuccessNotification(`Game created with ${createdTeams.length} teams and ${formData.num_rounds} rounds!`);

      // Wait a moment to show completion, then show success screen
      setTimeout(() => setShowSuccess(true), 800);
    } catch (error: any) {
      showError('Failed to create game', error);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showSuccessNotification(`${label} copied to clipboard!`);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 4,
      }}
    >
      <Container maxWidth="md">
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
            <Typography variant="h4" fontWeight={700}>
              {showSuccess ? 'Game Created!' : 'Create New Game'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
              {showSuccess ? 'Your game is ready' : 'Set up a new Bonopoly game for your students'}
            </Typography>
          </Box>

          {/* Main Content */}
          <Box sx={{ p: 4 }}>
            {!showSuccess ? (
              <>
                {/* Game Information Section */}
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Game Information
                </Typography>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Game Name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g., MBA Fall 2024"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Your Email"
                      type="email"
                      value={formData.educator_email}
                      onChange={(e) => handleChange('educator_email', e.target.value)}
                      placeholder="professor@university.edu"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Number of Teams"
                      type="number"
                      value={formData.num_teams}
                      onChange={(e) => handleChange('num_teams', parseInt(e.target.value))}
                      inputProps={{ min: 3, max: 8 }}
                      helperText="3-8 teams recommended"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Number of Rounds"
                      type="number"
                      value={formData.num_rounds}
                      onChange={(e) => handleChange('num_rounds', parseInt(e.target.value))}
                      inputProps={{ min: 3, max: 6 }}
                      helperText="3-6 rounds recommended"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Hours per Round"
                      type="number"
                      value={formData.hours_per_round}
                      onChange={(e) => handleChange('hours_per_round', parseInt(e.target.value))}
                      inputProps={{ min: 24, max: 336 }}
                      helperText="168 hours = 1 week"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Timezone"
                      value={formData.timezone}
                      onChange={(e) => handleChange('timezone', e.target.value)}
                    >
                      {TIMEZONES.map((tz) => (
                        <MenuItem key={tz} value={tz}>
                          {tz}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Game Difficulty
                    </Typography>
                    <Grid container spacing={2}>
                      {TEMPLATES.map((template) => (
                        <Grid item xs={12} sm={4} key={template.value}>
                          <Card
                            sx={{
                              cursor: 'pointer',
                              border: 2,
                              borderColor:
                                formData.template === template.value
                                  ? 'primary.main'
                                  : 'transparent',
                              '&:hover': { borderColor: 'primary.light' },
                            }}
                            onClick={() => handleChange('template', template.value)}
                          >
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                {template.label}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {template.description}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                </Grid>

                {/* Debug Parameters Toggle */}
                <Box sx={{ mt: 2, mb: 4 }}>
                  <Button
                    size="small"
                    onClick={() => setShowDebugParams(!showDebugParams)}
                    sx={{ textTransform: 'none' }}
                  >
                    {showDebugParams ? '▼ Hide' : '▶ Show'} Game Parameters (Debug)
                  </Button>
                  {showDebugParams && (
                    <Paper sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5' }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Current Configuration (JSON)
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          overflow: 'auto',
                          m: 0,
                        }}
                      >
                        {JSON.stringify(formData, null, 2)}
                      </Box>
                    </Paper>
                  )}
                </Box>

                <Divider sx={{ my: 4 }} />

                {/* Teams Section */}
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Teams ({formData.num_teams})
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Auto-generated team names (you can customize them below). Emails are optional.
                </Typography>

                <Grid container spacing={1.5}>
                  {teams.map((team, index) => (
                    <Grid item xs={12} key={index}>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Typography
                          variant="body2"
                          sx={{ minWidth: 60, fontWeight: 600, color: 'text.secondary' }}
                        >
                          Team {index + 1}
                        </Typography>
                        <TextField
                          size="small"
                          value={team.team_name}
                          onChange={(e) => updateTeam(index, 'team_name', e.target.value)}
                          placeholder="Team Name"
                          sx={{ width: 200 }}
                        />
                        <TextField
                          size="small"
                          type="email"
                          value={team.email}
                          onChange={(e) => updateTeam(index, 'email', e.target.value)}
                          placeholder="Email (Optional)"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Divider sx={{ my: 4 }} />

                {/* Create Button */}
                <Box sx={{ textAlign: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={isCreating ? <CircularProgress size={20} color="inherit" /> : <Check />}
                    onClick={handleCreateGame}
                    disabled={isCreating || !formData.name || !formData.educator_email}
                    sx={{
                      background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                      px: 6,
                      py: 1.5,
                    }}
                  >
                    {isCreating ? 'Creating Game...' : 'Create Game'}
                  </Button>
                </Box>

                {/* Progress Terminal */}
                {isCreating && progressSteps.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <ProgressTerminal
                      steps={progressSteps}
                      title="Creating your game..."
                    />
                  </Box>
                )}
              </>
            ) : gameCredentials ? (
              // Success Screen
              <Box textAlign="center">
                <Check sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  Game Created Successfully!
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                  Save these credentials - you'll need them to log in
                </Typography>

                <Paper sx={{ p: 3, backgroundColor: '#f5f5f5', mb: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Game Code (6 characters)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                    <Typography
                      variant="h3"
                      fontWeight={700}
                      fontFamily="monospace"
                      sx={{ letterSpacing: 4 }}
                    >
                      {gameCredentials.game_code}
                    </Typography>
                    <Button
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(gameCredentials.game_code, 'Game Code')}
                      sx={{ ml: 2 }}
                    >
                      Copy
                    </Button>
                  </Box>
                </Paper>

                <Paper sx={{ p: 3, backgroundColor: '#f5f5f5', mb: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Game PIN (7 digits)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                    <Typography
                      variant="h3"
                      fontWeight={700}
                      fontFamily="monospace"
                      sx={{ letterSpacing: 4 }}
                    >
                      {gameCredentials.game_pin}
                    </Typography>
                    <Button
                      startIcon={<ContentCopy />}
                      onClick={() => copyToClipboard(gameCredentials.game_pin, 'Game PIN')}
                      sx={{ ml: 2 }}
                    >
                      Copy
                    </Button>
                  </Box>
                </Paper>

                <Divider sx={{ my: 3 }} />

                {/* Team Login Links */}
                {gameCredentials.teams && gameCredentials.teams.length > 0 && (
                  <>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      Team Login Links
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Share these links with each team. The PIN is pre-filled in the URL.
                    </Typography>
                    <Paper sx={{ p: 2, backgroundColor: '#fff8e1', mb: 3, maxHeight: 400, overflow: 'auto' }}>
                      <Grid container spacing={2}>
                        {gameCredentials.teams.map((team) => (
                          <Grid item xs={12} key={team.team_id}>
                            <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="body1" fontWeight={600}>
                                  {team.team_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                                  PIN: {team.team_pin}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                  variant="body2"
                                  fontFamily="monospace"
                                  sx={{
                                    flex: 1,
                                    p: 1,
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: 1,
                                    fontSize: '0.75rem',
                                    overflow: 'auto',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {window.location.origin}/login?role=team&code={gameCredentials.game_code}&pin={team.team_pin}
                                </Typography>
                                <Button
                                  startIcon={<ContentCopy />}
                                  onClick={() => copyToClipboard(
                                    `${window.location.origin}/login?role=team&code=${gameCredentials.game_code}&pin=${team.team_pin}`,
                                    `${team.team_name} link`
                                  )}
                                  size="small"
                                  variant="outlined"
                                >
                                  Copy
                                </Button>
                                <Button
                                  startIcon={<Share />}
                                  onClick={() => {
                                    if (navigator.share) {
                                      navigator.share({
                                        title: `Bonopoly - ${team.team_name}`,
                                        text: `Join ${formData.name} as ${team.team_name}`,
                                        url: `${window.location.origin}/login?role=team&code=${gameCredentials.game_code}&pin=${team.team_pin}`
                                      });
                                    }
                                  }}
                                  size="small"
                                  variant="outlined"
                                >
                                  Share
                                </Button>
                              </Box>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Paper>
                  </>
                )}

                <Divider sx={{ my: 3 }} />

                <Alert severity="success" sx={{ mb: 3 }}>
                  <strong>Next Steps:</strong> Share the team-specific login links above with each team. The links contain pre-filled PINs, so teams can log in with one click!
                </Alert>

                <Button
                  variant="contained"
                  size="large"
                  onClick={async () => {
                    // Auto-login with the credentials we just created
                    const success = await loginEducator(gameCredentials.game_code, gameCredentials.game_pin);
                    if (success) {
                      navigate('/educator/dashboard');
                    }
                  }}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    px: 4,
                  }}
                >
                  Go to Dashboard →
                </Button>
              </Box>
            ) : null}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
