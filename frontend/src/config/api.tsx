// API Configuration

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "https://riskguardian.onrender.com";

// ðŸ”¥ Universal API helper
export const api = (path: string) => `${API_BASE_URL}${path}`;

export const API_ENDPOINTS = {
  // Auth
  login: api("/api/v1/auth-multi/login"),
  register: api("/api/v1/auth-multi/register"),

  // Accounts
  accounts: api("/api/v1/accounts-multi"),
  accountInfo: api("/api/v1/accounts/info"),

  // Analytics
  analytics: api("/api/v1/analytics/performance"),

  // Positions
  positions: api("/api/v1/positions"),

  // Trades
  tradesStats: api("/api/v1/trades/stats/summary"),
  tradesHistory: api("/api/v1/trades/history"),

  // Journal
  journal: api("/api/v1/journal"),

  // Platforms
  platforms: api("/api/v1/platforms"),
};

export default API_BASE_URL;

