import React, { useEffect, useState } from "react";
import axios from "axios";

import {
Box,
Grid,
Card,
CardContent,
Typography
} from "@mui/material";

import {
ComposableMap,
Geographies,
Geography,
Marker
} from "react-simple-maps";

import {
ResponsiveContainer,
LineChart,
Line,
XAxis,
YAxis,
Tooltip
} from "recharts";


const geoUrl =
"https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";


export default function FounderDashboard(){

const [stats,setStats]=useState({});
const [revenue,setRevenue]=useState({});
const [health,setHealth]=useState({});
const [trades,setTrades]=useState([]);
const [onlineUsers,setOnlineUsers]=useState(0);
const [revenueChart,setRevenueChart]=useState([]);
const [risk,setRisk]=useState([]);
const [mapData,setMapData]=useState([]);


const loadData = async()=>{

try{

const overview = await axios.get(
"http://127.0.0.1:8000/api/v1/admin/overview"
)

setStats(overview.data)


const revenueData = await axios.get(
"http://127.0.0.1:8000/api/v1/founder/revenue"
).catch(()=>({data:{monthly_revenue:0}}))

setRevenue(revenueData.data)


const server = await axios.get(
"http://127.0.0.1:8000/api/v1/founder/server-health"
).catch(()=>({data:{cpu:0,memory:0}}))

setHealth(server.data)


const usersRes = await axios.get(
"http://127.0.0.1:8000/api/v1/founder/users-online"
).catch(()=>({data:{online_users:0}}))

setOnlineUsers(usersRes.data.online_users)


const revenueAnalytics = await axios.get(
"http://127.0.0.1:8000/api/v1/founder/revenue-analytics"
).catch(()=>({data:[]}))

setRevenueChart(revenueAnalytics.data)


const riskRes = await axios.get(
"http://127.0.0.1:8000/api/v1/founder/prop-risk"
).catch(()=>({data:[]}))

setRisk(riskRes.data)


const mapRes = await axios.get(
"http://127.0.0.1:8000/api/v1/founder/trader-map"
).catch(()=>({data:[]}))

setMapData(mapRes.data)


}catch(e){

console.log(e)

}

}


useEffect(()=>{

loadData()

const interval=setInterval(loadData,10000)

return()=>clearInterval(interval)

},[])



/* FIREHOSE TRADES */

useEffect(()=>{

const socket = new WebSocket(
"ws://127.0.0.1:8000/ws/admin/live-trades"
)

socket.onmessage = (event)=>{

const data = JSON.parse(event.data)

setTrades(data)

}

return ()=>socket.close()

},[])



return(

<Box sx={{p:4}}>

<Typography variant="h4" fontWeight="bold" mb={4}>
Founder Command Center
</Typography>


{/* TOP METRICS */}

<Grid container spacing={3} mb={4}>

<Metric title="Total Users" value={stats.total_users}/>

<Metric title="Visitors Today" value={stats.visitors_today}/>

<Metric title="Trading Accounts" value={stats.trading_accounts}/>

<Metric title="Risk Alerts" value={stats.risk_alerts}/>

</Grid>


{/* SECOND ROW */}

<Grid container spacing={3} mb={4}>

<Metric title="Users Online ðŸ‘¥" value={onlineUsers}/>

<Metric title="Monthly Revenue ðŸ’°" value={`$${revenue.monthly_revenue||0}`}/>

<Metric title="CPU Usage ðŸ–¥" value={`${health.cpu||0}%`}/>

<Metric title="Memory Usage" value={`${health.memory||0}%`}/>

</Grid>


{/* GLOBAL MAP */}

<Card sx={cardStyle}>

<CardContent>

<Typography variant="h6" mb={2}>
ðŸŒ Global Trader Activity
</Typography>

<Box sx={{height:320}}>

<ComposableMap projectionConfig={{scale:140}}>

<Geographies geography={geoUrl}>

{({geographies})=>
geographies.map((geo)=>(

<Geography
key={geo.rsmKey}
geography={geo}
style={{
default:{fill:"#0f172a"},
hover:{fill:"#1e293b"},
pressed:{fill:"#1e293b"}
}}
/>

))
}

</Geographies>


{/* GLOWING TRADER NODES */}

{mapData.map((m,i)=>(

<Marker key={i} coordinates={m.coordinates}>

<g>

{/* glowing pulse */}

<circle
r={12 + (m.users||1)}
fill="rgba(34,197,94,0.15)"
style={{
animation:"pulse 2s infinite"
}}
/>

{/* main node */}

<circle
r={5 + (m.users||1)}
fill="#22c55e"
stroke="#ffffff"
strokeWidth={1}
/>

</g>

</Marker>

))}

</ComposableMap>

</Box>

</CardContent>

</Card>


{/* FIREHOSE */}

<Card sx={{...cardStyle,mt:4}}>

<CardContent>

<Typography variant="h6" mb={2}>
ðŸ”¥ MT5 Trade Firehose
</Typography>

{trades.slice(0,10).map((t,i)=>(

<Box
key={i}
sx={{
display:"flex",
justifyContent:"space-between",
borderBottom:"1px solid rgba(255,255,255,0.05)",
py:1,
animation:"tradePulse 1s ease"
}}
>

<span>{t.symbol}</span>

<span>{t.volume} lots</span>

<span style={{color:"#22c55e"}}>
{t.profit}
</span>

</Box>

))}

</CardContent>

</Card>


{/* REVENUE CHART */}

<Card sx={{...cardStyle,mt:4}}>

<CardContent>

<Typography variant="h6" mb={2}>
ðŸ“ˆ Revenue Growth
</Typography>

<ResponsiveContainer width="100%" height={250}>

<LineChart data={revenueChart}>

<XAxis dataKey="month"/>

<YAxis/>

<Tooltip/>

<Line
type="monotone"
dataKey="revenue"
stroke="#22c55e"
/>

</LineChart>

</ResponsiveContainer>

</CardContent>

</Card>


{/* PROP FIRM RISK */}

<Card sx={{...cardStyle,mt:4}}>

<CardContent>

<Typography variant="h6" mb={2}>
âš  Prop Firm Risk Monitor
</Typography>

{risk.map((r,i)=>(

<Box key={i}>
{r.user} â€” {r.rule}
</Box>

))}

</CardContent>

</Card>


</Box>

)

}


function Metric({title,value}){

return(

<Grid item xs={12} md={3}>

<Card sx={cardStyle}>

<CardContent>

<Typography variant="subtitle2">
{title}
</Typography>

<Typography variant="h4">
{value||0}
</Typography>

</CardContent>

</Card>

</Grid>

)

}


const cardStyle={
background:"#0f172a",
color:"white",
borderRadius:3,
boxShadow:"0px 8px 25px rgba(0,0,0,0.5)"
}

