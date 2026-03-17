import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AdminAccounts() {

  const [accounts, setAccounts] = useState([]);

  const loadAccounts = async () => {

    const res = await axios.get(
      "http://localhost:8000/api/v1/admin/active-accounts"
    );

    setAccounts(res.data);

  };

  useEffect(() => {

    loadAccounts();
    const interval = setInterval(loadAccounts, 5000);

    return () => clearInterval(interval);

  }, []);

  return (

    <div style={{ padding: 40 }}>

      <h2>Active MT5 Accounts</h2>

      {accounts.map((a,i)=>(
        <div key={i}>
          {a.login} | {a.broker}
        </div>
      ))}

    </div>

  );

}