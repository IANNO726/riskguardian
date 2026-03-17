/**
 * NewsCalendarWidget.tsx
 * ----------------------
 * Displays upcoming high-impact economic events from ForexFactory.
 * Used in the Simulator to warn traders before placing trades.
 * Also available as standalone widget on the dashboard.
 *
 * Drop into Simulator.tsx near the trade form.
 * Standalone usage: import NewsCalendarWidget from './NewsCalendarWidget'
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, CircularProgress, IconButton,
  Collapse, Tooltip,
} from '@mui/material';
import { Refresh, ExpandMore, ExpandLess, Warning } from '@mui/icons-material';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

interface NewsEvent {
  title:          string;
  currency:       string;
  impact:         string;
  datetime_utc:   string;
  affected_pairs: string[];
  minutes_away:   number;
  forecast?:      string;
  previous?:      string;
}

interface Props {
  symbol?:        string;   // if provided, only show events for this symbol
  compact?:       boolean;  // minimal display
  hours?:         number;   // how far ahead to look (default 48)
  onNewsAlert?:   (events: NewsEvent[]) => void;  // callback when imminent events exist
}

const IMPACT_COLORS: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#22c55e',
};

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
  CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳',
};

function formatMinutes(mins: number): string {
  if (mins < 0) return 'Passed';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatEventTime(dtStr: string): string {
  try {
    const dt = new Date(dtStr + 'Z');
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch {
    return dtStr.slice(11, 16);
  }
}

function formatEventDate(dtStr: string): string {
  try {
    const dt = new Date(dtStr + 'Z');
    return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dtStr.slice(0, 10);
  }
}

const NewsCalendarWidget: React.FC<Props> = ({
  symbol,
  compact = false,
  hours = 48,
  onNewsAlert,
}) => {
  const [events,    setEvents]    = useState<NewsEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { hours };
      if (symbol) params.symbol = symbol;
      const resp = await axios.get(`${API}/simulator/news`, { params });
      const evts: NewsEvent[] = resp.data.events || [];
      setEvents(evts);
      setLastFetch(new Date());

      // Notify parent if there are imminent events (within 30 minutes)
      const imminent = evts.filter(e => e.minutes_away <= 30 && e.minutes_away >= -5);
      if (imminent.length > 0 && onNewsAlert) {
        onNewsAlert(imminent);
      }
    } catch {
      // silently fail — news is supplementary
    } finally {
      setLoading(false);
    }
  }, [symbol, hours, onNewsAlert]);

  useEffect(() => {
    fetchNews();
    // Auto-refresh every 15 minutes
    const interval = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const imminentEvents = events.filter(e => e.minutes_away <= 30 && e.minutes_away >= -5);
  const upcomingEvents = events.filter(e => e.minutes_away > 30);

  if (compact) {
    // Minimal pill for the trade form area
    if (events.length === 0 && !loading) return null;
    if (imminentEvents.length === 0 && upcomingEvents.length === 0 && !loading) return null;

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {loading ? (
          <Chip
            icon={<CircularProgress size={10} sx={{ color: 'rgba(255,255,255,0.4) !important' }} />}
            label="Loading news..."
            size="small"
            sx={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        ) : imminentEvents.length > 0 ? (
          <>
            <Chip
              icon={<Warning sx={{ fontSize: '13px !important', color: '#ef4444 !important' }} />}
              label={`⚠ ${imminentEvents.length} news in ${formatMinutes(Math.min(...imminentEvents.map(e => e.minutes_away)))}`}
              size="small"
              sx={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', fontWeight: 700 }}
            />
            {imminentEvents.slice(0, 2).map((e, i) => (
              <Chip
                key={i}
                label={`${CURRENCY_FLAGS[e.currency] || ''} ${e.currency} ${e.title.slice(0, 20)}${e.title.length > 20 ? '…' : ''}`}
                size="small"
                sx={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '11px' }}
              />
            ))}
          </>
        ) : (
          <Chip
            label={`📅 Next: ${events[0]?.title?.slice(0,25) || '—'} in ${formatMinutes(events[0]?.minutes_away || 0)}`}
            size="small"
            sx={{ background: 'rgba(56,189,248,0.08)', color: 'rgba(56,189,248,0.7)', border: '1px solid rgba(56,189,248,0.2)', fontSize: '11px' }}
          />
        )}
      </Box>
    );
  }

  // Full widget
  return (
    <Box sx={{ borderRadius: '18px', background: 'linear-gradient(135deg,rgba(239,68,68,0.06),rgba(251,191,36,0.04))', border: '1px solid rgba(239,68,68,0.2)', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2, cursor: 'pointer', borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <Box sx={{ fontSize: 20 }}>📅</Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
            Economic Calendar
          </Typography>
          {!collapsed && (
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', mt: 0.2 }}>
              {loading ? 'Fetching…' : `${events.length} high-impact events · next ${hours}h`}
              {lastFetch && !loading && (
                <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.2)' }}>
                  Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </Typography>
          )}
        </Box>
        {imminentEvents.length > 0 && (
          <Chip
            label={`⚠ ${imminentEvents.length} imminent`}
            size="small"
            sx={{ height: 22, fontSize: '11px', fontWeight: 700, background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
          />
        )}
        <Tooltip title="Refresh calendar">
          <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); fetchNews(); }}
            disabled={loading}
            sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ef4444' } }}
          >
            {loading ? <CircularProgress size={14} sx={{ color: 'rgba(255,255,255,0.3) !important' }} /> : <Refresh sx={{ fontSize: 15 }} />}
          </IconButton>
        </Tooltip>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.3)' }}>
          {collapsed ? <ExpandMore sx={{ fontSize: 17 }} /> : <ExpandLess sx={{ fontSize: 17 }} />}
        </IconButton>
      </Box>

      <Collapse in={!collapsed}>
        {loading && events.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2.5 }}>
            <CircularProgress size={18} sx={{ color: '#ef4444' }} />
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              Fetching economic calendar…
            </Typography>
          </Box>
        ) : events.length === 0 ? (
          <Box sx={{ px: 2.5, py: 2.5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              ✅ No high-impact news in the next {hours} hours
            </Typography>
            {symbol && (
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', mt: 0.5 }}>
                Showing events that affect {symbol.toUpperCase()} only
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ px: 2, py: 1.5 }}>

            {/* IMMINENT — within 30 min */}
            {imminentEvents.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.1em', mb: 1, px: 0.5 }}>
                  ⚠ Imminent — within 30 minutes
                </Typography>
                {imminentEvents.map((ev, i) => (
                  <EventRow key={i} ev={ev} urgent />
                ))}
              </Box>
            )}

            {/* UPCOMING */}
            {upcomingEvents.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.1em', mb: 1, px: 0.5 }}>
                  Upcoming
                </Typography>
                {upcomingEvents.slice(0, 8).map((ev, i) => (
                  <EventRow key={i} ev={ev} urgent={false} />
                ))}
                {upcomingEvents.length > 8 && (
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', mt: 1 }}>
                    +{upcomingEvents.length - 8} more events
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Box>
  );
};

// ── Event row sub-component ───────────────────────────────────────────────────

const EventRow: React.FC<{ ev: NewsEvent; urgent: boolean }> = ({ ev, urgent }) => {
  const bg     = urgent ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)';
  const border = urgent ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)';
  const flag   = CURRENCY_FLAGS[ev.currency] || '🌐';
  const minsLabel = ev.minutes_away < 0
    ? `${Math.abs(ev.minutes_away)}m ago`
    : formatMinutes(ev.minutes_away);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 1,
      borderRadius: '10px', background: bg, border: `1px solid ${border}`,
    }}>
      {/* Flag + currency */}
      <Box sx={{ width: 40, flexShrink: 0, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '18px', lineHeight: 1 }}>{flag}</Typography>
        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
          {ev.currency}
        </Typography>
      </Box>

      {/* Title + time */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'white', lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ev.title}
        </Typography>
        <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mt: 0.3 }}>
          {formatEventDate(ev.datetime_utc)} · {formatEventTime(ev.datetime_utc)}
          {ev.forecast && ` · Forecast: ${ev.forecast}`}
        </Typography>
      </Box>

      {/* Affected pairs (first 2) */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'flex-end', flexShrink: 0 }}>
        {ev.affected_pairs.slice(0, 2).map((p, i) => (
          <Typography key={i} sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
            {p}
          </Typography>
        ))}
        {ev.affected_pairs.length > 2 && (
          <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
            +{ev.affected_pairs.length - 2}
          </Typography>
        )}
      </Box>

      {/* Time chip */}
      <Chip
        label={minsLabel}
        size="small"
        sx={{
          height: 24, fontSize: '11px', fontWeight: 700, flexShrink: 0,
          background: urgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
          color: urgent ? '#ef4444' : 'rgba(255,255,255,0.5)',
          border: `1px solid ${urgent ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
          minWidth: 52,
        }}
      />
    </Box>
  );
};

export default NewsCalendarWidget;