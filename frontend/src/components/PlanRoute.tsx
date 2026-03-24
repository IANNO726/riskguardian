import React, { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { usePlan, Plan, startCheckout } from '../hooks/usePlan';
import { UpgradePrompt } from './FeatureGate';

// growth must be between pro and enterprise
const PLAN_ORDER: Plan[] = ['free', 'starter', 'pro', 'growth', 'enterprise'];

const PLAN_FEATURE_NAMES: Partial<Record<string, string>> = {
  '/app/journal':    'AI Trading Journal',
  '/app/analytics':  'Advanced Analytics',
  '/app/terminal':   'Trading Terminal',
  '/app/enterprise': 'Enterprise Dashboard',
};

interface PlanRouteProps {
  requiredPlan: Plan;
  children:     React.ReactNode;
  featureName?: string;
}

const PlanRoute: React.FC<PlanRouteProps> = ({ requiredPlan, children, featureName }) => {
  const { plan, loading } = usePlan();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const hasAccess = PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(requiredPlan);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: '#a855f7' }} />
      </Box>
    );
  }

  if (!hasAccess) {
    const name = featureName || PLAN_FEATURE_NAMES[window.location.hash.replace('#', '')] || 'This Feature';
    return (
      <Box sx={{ p: 4 }}>
        <UpgradePrompt
          requiredPlan={requiredPlan}
          featureName={name}
          upgradeLoading={upgradeLoading}
          onUpgrade={() => !upgradeLoading && startCheckout(requiredPlan, setUpgradeLoading)}
        />
      </Box>
    );
  }

  return <>{children}</>;
};

export default PlanRoute;

