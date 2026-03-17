// API Configuration
export const API_BASE_URL = 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Auth
  login: `${API_BASE_URL}/api/v1/auth-multi/login`,
  register: `${API_BASE_URL}/api/v1/auth-multi/register`,
  
  // Accounts
  accounts: `${API_BASE_URL}/api/v1/accounts-multi`,
  accountInfo: `${API_BASE_URL}/api/v1/accounts/info`,
  
  // Analytics
  analytics: `${API_BASE_URL}/api/v1/analytics/performance`,
  
  // Positions
  positions: `${API_BASE_URL}/api/v1/positions`,
  
  // Trades
  tradesStats: `${API_BASE_URL}/api/v1/trades/stats/summary`,
  tradesHistory: `${API_BASE_URL}/api/v1/trades/history`,
  
  // Journal
  journal: `${API_BASE_URL}/api/v1/journal`,
  
  // Platforms
  platforms: `${API_BASE_URL}/api/v1/platforms`,
};
