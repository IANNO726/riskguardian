import React, { useEffect, useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || 'https://riskguardian.onrender.com';

export default function AdminRisk() {
  const [violations, setViolations] = useState([]);

  const loadRisk = async () => {
    try {
      const res = await axios.get(`${API}/api/v1/admin/risk-violations`);
      setViolations(res.data);
    } catch {}
  };

  useEffect(() => {
    loadRisk();
    const interval = setInterval(loadRisk, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2>Risk Rule Violations</h2>
      {violations.map((v: any, i: number) => (
        <div key={i}>⚠ {v.rule}</div>
      ))}
    </div>
  );
}

