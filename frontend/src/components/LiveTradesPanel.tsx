import React from "react";
import { Card, CardContent, Typography, Stack, Box, Chip, Grid } from "@mui/material";
import { useLiveTrades } from "../hooks/useLiveTrades";

export default function LiveTradesPanel() {
  const { balance, equity, profit, currency, connected, error } = useLiveTrades();

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Live MT5 Connection
        </Typography>

        <Stack spacing={2}>
          <Box>
            <Chip
              label={connected ? "Connected" : "Disconnected"}
              color={connected ? "success" : "error"}
              size="small"
            />
          </Box>

          {error && (
            <Typography color="error" variant="body2">
              Error: {error}
            </Typography>
          )}

          {connected && balance !== null ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography variant="h5" color="primary" fontWeight={600}>
                    {balance.toFixed(2)} {currency}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Equity
                  </Typography>
                  <Typography variant="h5" color="success.main" fontWeight={600}>
                    {equity !== null ? equity.toFixed(2) : "0.00"} {currency}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Profit
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={600}
                    color={profit !== null && profit >= 0 ? "success.main" : "error.main"}
                  >
                    {profit !== null ? profit.toFixed(2) : "0.00"} {currency}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {connected ? "Loading balance..." : "Connecting to MT5..."}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

