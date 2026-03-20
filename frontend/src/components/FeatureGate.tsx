import React from 'react';
import { Tooltip, Box, CircularProgress } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { usePlan, Plan, PlanFeatures } from '../hooks/usePlan';

const PLAN_COLORS: Record<Plan, string> = {
  free:       '#64748b',
  starter:    '#38bdf8',
  pro:        '#a855f7',
  enterprise: '#f59e0b',
};

const PLAN_LABELS: Record<Plan, string> = {
  free:       'Free',
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
};

const FEATURE_REQUIRED_PLAN: Record<keyof PlanFeatures, Plan> = {
  max_accounts:          'starter',
  ai_journal:            'pro',
  telegram_alerts:       'pro',
  sms_alerts:            'pro',
  prop_firm_profiles:    'pro',
  performance_analytics: 'pro',
  trade_history_days:    'starter',
  priority_support:      'pro',
  white_label:           'enterprise',
  api_access:            'enterprise',
  team_management:       'enterprise',
  custom_risk_rules:     'starter',
  dedicated_manager:     'enterprise',
  sla_guarantee:         'enterprise',
  custom_integrations:   'enterprise',
};

export const PLAN_ORDER: Plan[] = ['free', 'starter', 'pro', 'enterprise'];

export function isPlanSufficient(userPlan: Plan, requiredPlan: Plan): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

// �”€�”€ FeatureGate �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
interface FeatureGateProps {
  feature:       keyof PlanFeatures;
  children:      React.ReactNode;
  requiredPlan?: Plan;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ feature, children, requiredPlan }) => {
  const { plan } = usePlan();
  const required  = requiredPlan ?? FEATURE_REQUIRED_PLAN[feature];
  const hasAccess = isPlanSufficient(plan, required);

  if (hasAccess) return <>{children}</>;

  const requiredLabel = PLAN_LABELS[required];
  const requiredColor = PLAN_COLORS[required];

  return (
    <Tooltip
      title={
        <Box sx={{ p: 0.5 }}>
          <Box sx={{ fontSize: '13px', fontWeight: 700, mb: 0.5 }}>�Ÿ”’ {requiredLabel} Plan Required</Box>
          <Box sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
            Upgrade to <span style={{ color: requiredColor, fontWeight: 700 }}>{requiredLabel}</span> to unlock this feature.
          </Box>
        </Box>
      }
      arrow placement="top"
    >
      <Box sx={{ position: 'relative', display: 'inline-flex', width: '100%' }}>
        <Box sx={{ opacity: 0.35, pointerEvents: 'none', filter: 'grayscale(60%)', width: '100%' }}>
          {children}
        </Box>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(0,0,0,0.75)', border: `1px solid ${requiredColor}40`,
          borderRadius: '20px', px: 1.5, py: 0.5,
          backdropFilter: 'blur(4px)', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <LockIcon sx={{ fontSize: 12, color: requiredColor }} />
          <Box sx={{ fontSize: '11px', fontWeight: 700, color: requiredColor, letterSpacing: '0.05em' }}>
            {requiredLabel}
          </Box>
        </Box>
      </Box>
    </Tooltip>
  );
};

// �”€�”€ PlanBadge �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
export const PlanBadge: React.FC = () => {
  const { plan, loading } = usePlan();
  if (loading) return null;
  const color = PLAN_COLORS[plan];
  const label = PLAN_LABELS[plan];
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      px: 1.5, py: 0.5, borderRadius: '20px',
      background: `${color}18`, border: `1px solid ${color}40`,
      fontSize: '11px', fontWeight: 700, color,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </Box>
  );
};

// �”€�”€ UpgradePrompt �”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€�”€
interface UpgradePromptProps {
  requiredPlan:    Plan;
  featureName:     string;
  onUpgrade:       () => void;
  upgradeLoading?: boolean; // �œ… NEW
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({ requiredPlan, featureName, onUpgrade, upgradeLoading = false }) => {
  const { plan } = usePlan();
  const color = PLAN_COLORS[requiredPlan];
  const label = PLAN_LABELS[requiredPlan];
  const currentLabel = PLAN_LABELS[plan];

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', p: 6, textAlign: 'center',
      background: `radial-gradient(ellipse at 50% 0%, ${color}12, transparent 70%)`,
      border: `1px solid ${color}25`, borderRadius: '20px', minHeight: 340,
    }}>
      <Box sx={{ fontSize: '52px', mb: 2 }}>�Ÿ”’</Box>
      <Box sx={{ fontSize: '22px', fontWeight: 800, color: 'white', mb: 1 }}>
        {featureName} requires {label} Plan
      </Box>
      <Box sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', mb: 1 }}>
        You are currently on the <span style={{ color: PLAN_COLORS[plan], fontWeight: 700 }}>{currentLabel}</span> plan.
      </Box>
      <Box sx={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', mb: 4, maxWidth: 440 }}>
        Upgrade to <span style={{ color, fontWeight: 700 }}>{label}</span> to unlock this feature
        and take your trading to the next level.
      </Box>

      {/* �œ… Button with loading spinner */}
      <Box
        onClick={onUpgrade}
        sx={{
          px: 5, py: 1.8, display: 'flex', alignItems: 'center', gap: 1.5,
          background: upgradeLoading ? `${color}88` : `linear-gradient(90deg, ${color}, ${color}bb)`,
          borderRadius: '12px', fontSize: '15px', fontWeight: 700,
          color: 'white', cursor: upgradeLoading ? 'not-allowed' : 'pointer',
          transition: 'all .2s',
          boxShadow: `0 4px 20px ${color}40`,
          '&:hover': !upgradeLoading ? { transform: 'translateY(-2px)', boxShadow: `0 8px 30px ${color}50` } : {},
        }}
      >
        {upgradeLoading ? (
          <>
            <CircularProgress size={18} sx={{ color: 'white' }} />
            Opening Stripe...
          </>
        ) : (
          `Upgrade to ${label} �†’`
        )}
      </Box>

      <Box sx={{ mt: 2, fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
        Cancel anytime · Instant activation
      </Box>
    </Box>
  );
};

