import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AdminRisk() {

  const [violations, setViolations] = useState([]);

  const loadRisk = async () => {

    const res = await axios.get(
      "https://riskguardian.onrender.com/api/v1/admin/risk-violations"
    );

    setViolations(res.data);

  };

  useEffect(() => {

    loadRisk();
    const interval = setInterval(loadRisk, 5000);

    return () => clearInterval(interval);

  }, []);

  return (

    <div style={{ padding: 40 }}>

      <h2>Risk Rule Violations</h2>

      {violations.map((v,i)=>(
        <div key={i}>
          âš  {v.rule}
        </div>
      ))}

    </div>

  );

}

