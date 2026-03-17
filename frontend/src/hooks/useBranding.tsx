/**
 * useBranding — Global branding context
 * Loads white label settings from backend on login.
 * Used by AppShell to apply brand name, color, logo.
 *
 * Wrap in App.tsx alongside PlanProvider:
 *   <BrandingProvider><PlanProvider>...</PlanProvider></BrandingProvider>
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:8000/api/v1';

interface Branding {
  brand_name:    string;
  primary_color: string;
  logo_url:      string;
}

interface BrandingState {
  branding: Branding;
  loading:  boolean;
  refetch:  () => void;
  save:     (b: Branding) => Promise<boolean>;
}

const DEFAULT: Branding = { brand_name: 'RiskGuardian', primary_color: '#38bdf8', logo_url: '' };

export const BrandingContext = createContext<BrandingState>({
  branding: DEFAULT, loading: false,
  refetch: () => {}, save: async () => false,
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT);
  const [loading,  setLoading]  = useState(true);

  const fetchBranding = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await axios.get(`${API}/white-label/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBranding({ brand_name: data.brand_name, primary_color: data.primary_color, logo_url: data.logo_url || '' });
    } catch {
      // fallback to default
    } finally { setLoading(false); }
  };

  const save = async (b: Branding): Promise<boolean> => {
    const token = localStorage.getItem('access_token');
    if (!token) return false;
    try {
      await axios.post(`${API}/white-label/`, b, { headers: { Authorization: `Bearer ${token}` } });
      setBranding(b);
      return true;
    } catch { return false; }
  };

  useEffect(() => { fetchBranding(); }, []);

  return (
    <BrandingContext.Provider value={{ branding, loading, refetch: fetchBranding, save }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() { return useContext(BrandingContext); }
