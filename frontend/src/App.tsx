import React, { useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Snackbar, Alert, Slide } from '@mui/material'

import { PlanProvider, usePlan } from './hooks/usePlan'
import { BrandingProvider } from './hooks/useBranding'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import PlanRoute from './components/PlanRoute'

import Login from './pages/Login'
import Register from './pages/Register'
import SetupWizard from './pages/SetupWizard'
import Dashboard from './pages/Dashboard'
import Terminal from './pages/Terminal'
import Analytics from './pages/Analytics'
import History from './pages/History'
import JournalView from './pages/JournalView'
import Settings from './pages/Settings'
import EnterprisePage from './pages/EnterprisePage'
import MultiAccountDashboard from './pages/MultiAccountDashboard'
import RiskCheck from './pages/RiskCheck'   // �œ… NEW
import Simulator from './pages/Simulator'   // �œ… NEW

import AdminDashboard from './pages/AdminDashboard'
import AdminTrades from './pages/AdminTrades'
import AdminAccounts from './pages/AdminAccounts'
import AdminRisk from './pages/AdminRisk'
import FounderDashboard from './pages/FounderDashboard'


const RootRedirect = () => {
  const token = localStorage.getItem('access_token');
  if (token) return <Navigate to="/app" replace />;
  return (
    <iframe
      src="/landing.html"
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
      title="RiskGuardian"
    />
  );
};

const PLAN_LABELS: Record<string, string> = {
  starter:    '�ŸŽ‰ Starter Plan activated! Welcome aboard.',
  pro:        '�Ÿš€ Pro Plan activated! All features unlocked.',
  enterprise: '�Ÿ‘‘ Enterprise Plan activated! Full access granted.',
}

const PaymentToast = () => {
  const location        = useLocation()
  const navigate        = useNavigate()
  const { refreshPlan } = usePlan()
  const [open, setOpen]           = useState(false)
  const [message, setMessage]     = useState('')
  const [isSuccess, setIsSuccess] = useState(true)

  useEffect(() => {
    const params  = new URLSearchParams(location.search)
    const payment = params.get('payment')
    const plan    = params.get('plan')

    if (payment === 'success' && plan) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        user.plan = plan
        user.subscription_status = 'active'
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.setItem('selected_plan', plan)
      } catch {}
      setTimeout(() => { refreshPlan() }, 2000)
      setMessage(PLAN_LABELS[plan] || '�ŸŽ‰ Subscription activated!')
      setIsSuccess(true)
      setOpen(true)
      navigate('/app', { replace: true })
    } else if (payment === 'cancelled') {
      setMessage('Payment cancelled �€” no charge was made.')
      setIsSuccess(false)
      setOpen(true)
      navigate('/app', { replace: true })
    }
  }, [location.search, navigate, refreshPlan])

  return (
    <Snackbar open={open} autoHideDuration={6000} onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }} TransitionComponent={Slide}>
      <Alert onClose={() => setOpen(false)} severity={isSuccess ? 'success' : 'warning'}
        variant="filled" sx={{ fontSize: '15px', fontWeight: 600 }}>
        {message}
      </Alert>
    </Snackbar>
  )
}

const AppWithToast = ({ children }: { children: React.ReactNode }) => (
  <>
    <PaymentToast />
    <AppShell>{children}</AppShell>
  </>
)

function App() {
  return (
    <Router>
      <BrandingProvider>
        <PlanProvider>
          <Routes>

            {/* �”€�”€ Root �”€�”€ */}
            <Route path="/" element={<RootRedirect />} />

            {/* �”€�”€ Public �”€�”€ */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/setup"    element={<ProtectedRoute><SetupWizard /></ProtectedRoute>} />

            {/* �”€�”€ App routes �”€�”€ */}
            <Route path="/app" element={
              <ProtectedRoute><AppWithToast><Dashboard /></AppWithToast></ProtectedRoute>
            }/>

            <Route path="/app/accounts" element={
              <ProtectedRoute>
                <AppWithToast>
                  <PlanRoute requiredPlan="starter" featureName="Multi-Account Dashboard">
                    <MultiAccountDashboard />
                  </PlanRoute>
                </AppWithToast>
              </ProtectedRoute>
            }/>

            {/* �œ… Risk Check �€” Starter+ */}
            <Route path="/app/risk-check" element={
              <ProtectedRoute>
                <AppWithToast>
                  <PlanRoute requiredPlan="starter" featureName="Pre-Trade Risk Check">
                    <RiskCheck />
                  </PlanRoute>
                </AppWithToast>
              </ProtectedRoute>
            }/>

            <Route path="/app/simulator" element={
              <ProtectedRoute>
                <AppWithToast>
                  <PlanRoute requiredPlan="starter" featureName="Prop Firm Simulator">
                    <Simulator />
                  </PlanRoute>
                </AppWithToast>
              </ProtectedRoute>
            }/>

            <Route path="/app/history" element={
              <ProtectedRoute><AppWithToast><History /></AppWithToast></ProtectedRoute>
            }/>
            <Route path="/app/settings" element={
              <ProtectedRoute><AppWithToast><Settings /></AppWithToast></ProtectedRoute>
            }/>
            <Route path="/app/terminal" element={
              <ProtectedRoute>
                <AppWithToast>
                  <PlanRoute requiredPlan="starter" featureName="Trading Terminal">
                    <Terminal />
                  </PlanRoute>
                </AppWithToast>
              </ProtectedRoute>
            }/>
            <Route path="/app/analytics" element={
              <ProtectedRoute>
                <AppWithToast>
                  <PlanRoute requiredPlan="pro" featureName="Advanced Analytics">
                    <Analytics />
                  </PlanRoute>
                </AppWithToast>
              </ProtectedRoute>
            }/>
            <Route path="/app/journal" element={
              <ProtectedRoute>
                <AppWithToast>
                  <PlanRoute requiredPlan="pro" featureName="AI Trading Journal">
                    <JournalView />
                  </PlanRoute>
                </AppWithToast>
              </ProtectedRoute>
            }/>
            <Route path="/app/enterprise" element={
              <ProtectedRoute>
                <AppWithToast>
                  <PlanRoute requiredPlan="enterprise" featureName="Enterprise Dashboard">
                    <EnterprisePage />
                  </PlanRoute>
                </AppWithToast>
              </ProtectedRoute>
            }/>
            <Route path="/app/admin"          element={<ProtectedRoute><AppWithToast><AdminDashboard /></AppWithToast></ProtectedRoute>}/>
            <Route path="/app/admin/trades"   element={<ProtectedRoute><AppWithToast><AdminTrades /></AppWithToast></ProtectedRoute>}/>
            <Route path="/app/admin/accounts" element={<ProtectedRoute><AppWithToast><AdminAccounts /></AppWithToast></ProtectedRoute>}/>
            <Route path="/app/admin/risk"     element={<ProtectedRoute><AppWithToast><AdminRisk /></AppWithToast></ProtectedRoute>}/>
            <Route path="/app/founder"        element={<ProtectedRoute><AppWithToast><FounderDashboard /></AppWithToast></ProtectedRoute>}/>

            {/* �”€�”€ Catch all �”€�”€ */}
            <Route path="*" element={
              localStorage.getItem('access_token')
                ? <Navigate to="/app" replace />
                : <Navigate to="/login" replace />
            }/>

          </Routes>
        </PlanProvider>
      </BrandingProvider>
    </Router>
  )
}

export default App










