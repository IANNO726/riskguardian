import axios from "axios";

/* =========================
   API CLIENT
========================= */
const API_BASE_URL = "https://riskguardian.onrender.com/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* =========================
   RISK MANAGEMENT
========================= */
export const getRiskDashboard = async () => {
  const res = await api.get("/risk/dashboard");
  return res.data;
};

export const getExposure = async () => {
  const res = await api.get("/risk/exposure");
  return res.data;
};

/* =========================
   TRADES
========================= */
export const getTrades = async () => {
  const res = await api.get("/trades");
  return res.data;
};

export const getTradeStats = async () => {
  const res = await api.get("/trades/stats/summary");
  return res.data;
};

/* =========================
   POSITIONS
========================= */
export const getPositions = async () => {
  const res = await api.get("/positions");
  return res.data;
};

export const modifyPosition = async (
  ticket: number,
  stop_loss?: number,
  take_profit?: number
) => {
  const res = await api.put(`/positions/${ticket}/modify`, {
    stop_loss: stop_loss ?? null,
    take_profit: take_profit ?? null,
  });
  return res.data;
};

/* =========================
   RULES
========================= */
export const getRules = async () => {
  const res = await api.get("/rules");
  return res.data;
};

export const createRule = async (data: any) => {
  const res = await api.post("/rules", data);
  return res.data;
};

export const updateRule = async (id: number, data: any) => {
  const res = await api.put(`/rules/${id}`, data);
  return res.data;
};

export const deleteRule = async (id: number) => {
  const res = await api.delete(`/rules/${id}`);
  return res.data;
};

/* =========================
   ALERTS
========================= */
export const getAlerts = async () => {
  const res = await api.get("/alerts");
  return res.data;
};

export const acknowledgeAlert = async (id: number) => {
  const res = await api.post(`/alerts/${id}/acknowledge`);
  return res.data;
};

export default api;
export const getAccounts = () => api.get('/accounts');

