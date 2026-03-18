import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AdminTrades() {

  const [trades, setTrades] = useState([]);

  const loadTrades = async () => {

    const res = await axios.get(
      "https://riskguardian.onrender.com/api/v1/admin/live-trades"
    );

    setTrades(res.data);

  };

  useEffect(() => {

    loadTrades();
    const interval = setInterval(loadTrades, 5000);

    return () => clearInterval(interval);

  }, []);

  return (

    <div style={{ padding: 40 }}>

      <h2>Live Trades Monitor</h2>

      {trades.map((t,i)=>(
        <div key={i}>
          {t.symbol} | {t.volume} lots | P/L: {t.profit}
        </div>
      ))}

    </div>

  );

}

