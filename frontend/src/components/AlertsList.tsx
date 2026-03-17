import React, { useEffect, useState } from "react";
import { Card, CardContent, Typography, Button, Stack } from "@mui/material";
import { playNotification } from "../utils/sound";

export default function Alerts() {
  const [alerts, setAlerts] = useState<string[]>([]);

  // simulate new alert every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const newAlert = `New alert at ${new Date().toLocaleTimeString()}`;
      setAlerts(prev => [newAlert, ...prev]);
      playNotification();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Alerts Center 🔔
        </Typography>

        <Button
          variant="contained"
          onClick={playNotification}
          sx={{ mb: 2 }}
        >
          Test Notification Sound
        </Button>

        <Stack spacing={1}>
          {alerts.length === 0 ? (
            <Typography color="text.secondary">
              No alerts yet…
            </Typography>
          ) : (
            alerts.map((alert, i) => (
              <Typography key={i}>
                {alert}
              </Typography>
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
