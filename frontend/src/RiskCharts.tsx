import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

const equityData = [
  { day: "Mon", equity: 10000 },
  { day: "Tue", equity: 10080 },
  { day: "Wed", equity: 10020 },
  { day: "Thu", equity: 10110 },
  { day: "Fri", equity: 10170 },
];

const pnlData = [
  { day: "Mon", pnl: 80 },
  { day: "Tue", pnl: -60 },
  { day: "Wed", pnl: 120 },
  { day: "Thu", pnl: 90 },
  { day: "Fri", pnl: -20 },
];

export default function RiskCharts() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "32px" }}>

      {/* Equity Curve */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginBottom: "10px" }}>Equity Curve</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={equityData}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="equity" stroke="#4CAF50" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily P&L */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "14px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginBottom: "10px" }}>Daily P&L</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={pnlData}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="pnl" fill="#2196F3" />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
