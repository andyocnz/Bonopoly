/**
 * Progress Terminal Component
 *
 * Command-line style progress indicator for multi-step operations
 * Shows real-time status of each step (pending, running, success, error)
 */

import React from 'react';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import { CheckCircle, Error, HourglassEmpty, PlayArrow } from '@mui/icons-material';

export type StepStatus = 'pending' | 'running' | 'success' | 'error';

export type ProgressStep = {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
  timestamp?: number;
};

interface ProgressTerminalProps {
  steps: ProgressStep[];
  title?: string;
}

export function ProgressTerminal({ steps, title = 'Processing...' }: ProgressTerminalProps) {
  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === 'success').length;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <Paper
      sx={{
        bgcolor: '#1e1e1e',
        color: '#d4d4d4',
        p: 2,
        borderRadius: 2,
        fontFamily: '"Cascadia Code", "Courier New", monospace',
        fontSize: '0.875rem',
        maxHeight: '400px',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: '#569cd6',
            fontWeight: 600,
            fontFamily: 'inherit',
            mb: 1,
          }}
        >
          $ {title}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            bgcolor: '#333',
            '& .MuiLinearProgress-bar': {
              bgcolor: '#4ec9b0',
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: '#858585',
            fontFamily: 'inherit',
            mt: 0.5,
            display: 'block',
          }}
        >
          {completedSteps} of {totalSteps} steps completed
        </Typography>
      </Box>

      {/* Steps */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {steps.map((step) => (
          <StepLine key={step.id} step={step} />
        ))}
      </Box>

      {/* Footer */}
      {progress === 100 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #333' }}>
          <Typography
            variant="body2"
            sx={{
              color: '#4ec9b0',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            ✓ All operations completed successfully!
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function StepLine({ step }: { step: ProgressStep }) {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'pending':
        return <HourglassEmpty sx={{ fontSize: 16, color: '#858585' }} />;
      case 'running':
        return (
          <PlayArrow
            sx={{
              fontSize: 16,
              color: '#569cd6',
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
        );
      case 'success':
        return <CheckCircle sx={{ fontSize: 16, color: '#4ec9b0' }} />;
      case 'error':
        return <Error sx={{ fontSize: 16, color: '#f48771' }} />;
    }
  };

  const getStatusColor = () => {
    switch (step.status) {
      case 'pending':
        return '#858585';
      case 'running':
        return '#569cd6';
      case 'success':
        return '#4ec9b0';
      case 'error':
        return '#f48771';
    }
  };

  const getStatusText = () => {
    switch (step.status) {
      case 'pending':
        return 'PENDING';
      case 'running':
        return 'RUNNING';
      case 'success':
        return 'SUCCESS';
      case 'error':
        return 'ERROR';
    }
  };

  const timestamp = step.timestamp
    ? new Date(step.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        fontFamily: 'inherit',
        opacity: step.status === 'pending' ? 0.6 : 1,
      }}
    >
      {/* Icon */}
      {getStatusIcon()}

      {/* Timestamp */}
      {timestamp && (
        <Typography
          variant="caption"
          sx={{
            color: '#858585',
            fontFamily: 'inherit',
            minWidth: '65px',
          }}
        >
          {timestamp}
        </Typography>
      )}

      {/* Status Badge */}
      <Typography
        variant="caption"
        sx={{
          color: getStatusColor(),
          fontWeight: 700,
          fontFamily: 'inherit',
          minWidth: '70px',
        }}
      >
        [{getStatusText()}]
      </Typography>

      {/* Label */}
      <Typography
        variant="body2"
        sx={{
          color: getStatusColor(),
          fontFamily: 'inherit',
          flex: 1,
        }}
      >
        {step.label}
      </Typography>

      {/* Message */}
      {step.message && (
        <Typography
          variant="caption"
          sx={{
            color: '#858585',
            fontFamily: 'inherit',
            fontStyle: 'italic',
          }}
        >
          {step.message}
        </Typography>
      )}
    </Box>
  );
}
