import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Switch,
  FormControlLabel, Chip, LinearProgress
} from '@mui/material';
import { getRules } from '../services/api';

interface Rule {
  id: number;
  name: string;
  rule_type: string;
  value: number;
  unit: string;
  enabled: boolean;
  current_value: number;
  status: string;
}

const TradingRules: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await getRules();
      setRules(response.data.rules);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching rules:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return 'success';
      case 'warning': return 'warning';
      case 'danger': return 'error';
      default: return 'default';
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Trading Rules</Typography>
      
      <Grid container spacing={3}>
        {rules.map((rule) => (
          <Grid item xs={12} md={6} key={rule.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">{rule.name}</Typography>
                  <FormControlLabel
                    control={<Switch checked={rule.enabled} />}
                    label={rule.enabled ? 'Enabled' : 'Disabled'}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Limit: {rule.value} {rule.unit}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Current: {rule.current_value} {rule.unit}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={(rule.current_value / rule.value) * 100}
                    sx={{ height: 10, borderRadius: 5 }}
                    color={getStatusColor(rule.status) as any}
                  />
                </Box>

                <Chip 
                  label={rule.status.toUpperCase()} 
                  color={getStatusColor(rule.status) as any}
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default TradingRules;
