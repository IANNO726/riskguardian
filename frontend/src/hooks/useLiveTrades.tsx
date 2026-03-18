/**
 * useLiveTrades â€” Singleton live data store.
 *
 * The polling loop lives at MODULE level (outside React),
 * so it NEVER stops when navigating between pages.
 * Components just subscribe to the shared state.
 */

import { useState, useEffect } from "react";

const API  = process.env.REACT_APP_API_URL || "https://riskguardian.onrender.com";
const tok  = () => localStorage.getItem("access_token") || "";
const hdrs = () => ({ Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" });

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface Position {
  ticket:        number;
  symbol:        string;
  type:          string;
  volume:        number;
  price_open:    number;
  price_current: number;
  profit:        number;
  sl?:           number;
  tp?:           number;
}

export interface LiveTradesState {
  balance:         number;
  equity:          number;
  dailyPnl:        number;
  dailyPnlPct:     number;
  activePositions: number;
  connected:       boolean;
  accountName:     string;
  currency:        string;
  lastUpdated:     Date | null;
  positions:       Position[];
}

const DEFAULTS: LiveTradesState = {
  balance:         0,
  equity:          0,
  dailyPnl:        0,
  dailyPnlPct:     0,
  activePositions: 0,
  connected:       false,
  accountName:     "",
  currency:        "USD",
  lastUpdated:     null,
  positions:       [],
};

// â”€â”€ Singleton store (module-level, survives navigation) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _state: LiveTradesState           = { ...DEFAULTS };
let _listeners: Set<(s: LiveTradesState) => void> = new Set();
let _defaultId:  number | null        = null;
let _pollTimer:  ReturnType<typeof setInterval> | null = null;
let _fails       = 0;
let _booted      = false;
const MAX_FAILS  = 2;
const POLL_MS    = 6_000;   // 6 s â€” fast enough to feel live

function _notify(next: LiveTradesState) {
  _state = next;
  _listeners.forEach(fn => fn(next));
}

// â”€â”€ Account ID resolver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function _resolveId(): Promise<number | null> {
  if (_defaultId) return _defaultId;
  try {
    const res  = await fetch(`${API}/api/v1/accounts-multi/`, { headers: hdrs() });
    if (!res.ok) return null;
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) return null;
    const def  = list.find((a: any) => a.is_default) ?? list[0];
    _defaultId = def.id;
    return _defaultId;
  } catch {
    return null;
  }
}

// â”€â”€ Core fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function _fetchLive() {
  const id = await _resolveId();
  if (!id) {
    // No accounts yet â€” keep showing last known state, don't flip to disconnected
    return;
  }

  try {
    const res = await fetch(`${API}/api/v1/accounts-multi/${id}/live-data`, {
      headers: hdrs(),
      signal:  AbortSignal.timeout(7_000),   // 7s timeout â€” don't hang forever
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const info    = data.account_info ?? {};
    const balance = safeNum(info.balance);
    const equity  = safeNum(info.equity, balance);
    const profit  = safeNum(info.profit);
    const currency = info.currency ?? "USD";

    const rawPos  = data.positions ?? data.open_positions ?? [];
    const positions: Position[] = Array.isArray(rawPos)
      ? rawPos.map((p: any) => ({
          ticket:        p.ticket        ?? 0,
          symbol:        p.symbol        ?? "",
          type:          p.type          ?? p.order_type ?? "",
          volume:        safeNum(p.volume),
          price_open:    safeNum(p.price_open    ?? p.open_price),
          price_current: safeNum(p.price_current ?? p.current_price),
          profit:        safeNum(p.profit),
          sl:            p.sl != null ? safeNum(p.sl) : undefined,
          tp:            p.tp != null ? safeNum(p.tp) : undefined,
        }))
      : [];

    _fails = 0;
    _notify({
      balance,
      equity,
      dailyPnl:        profit,
      dailyPnlPct:     balance > 0 ? round2((profit / balance) * 100) : 0,
      activePositions: positions.length || safeNum(data.positions_count),
      connected:       true,
      accountName:     info.name ?? info.login ?? "",
      currency,
      lastUpdated:     new Date(),
      positions,
    });

  } catch (err: any) {
    // Timeout or network error
    _fails += 1;
    if (_fails >= MAX_FAILS) {
      // Only flip connected=false after 2 consecutive failures
      // Keep all other data (balance, equity) from last good fetch
      _notify({ ..._state, connected: false });
    }
    // If just 1 failure â€” keep showing last state as-is (no flicker)
  }
}

// â”€â”€ Retry on focus â€” reconnects instantly when user comes back to tab â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _onFocus() {
  _fails = 0;   // reset failure count on tab focus
  _fetchLive();
}

// â”€â”€ Boot the singleton (called once ever) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _boot() {
  if (_booted) return;
  _booted = true;

  _fetchLive();
  _pollTimer = setInterval(_fetchLive, POLL_MS);

  // Reconnect immediately when tab regains focus
  window.addEventListener("focus", _onFocus);

  // Reconnect if token changes (user logs in/out)
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === "access_token" || e.key === "rg_default_account_changed") {
      _defaultId = null;   // force re-resolve
      _fails     = 0;
      _fetchLive();
    }
  });
}

// â”€â”€ React hook â€” just subscribes to the singleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function useLiveTrades(): LiveTradesState {
  const [state, setState] = useState<LiveTradesState>(_state);

  useEffect(() => {
    // Boot polling if not already running
    _boot();

    // Subscribe to updates
    _listeners.add(setState);

    // Immediately sync with latest known state
    setState(_state);

    return () => {
      _listeners.delete(setState);
      // NOTE: we do NOT stop the poll or clear the timer on unmount
      // The singleton keeps running while the app is open
    };
  }, []);

  // Allow other code to force a re-resolve (e.g. after adding an account)
  useEffect(() => {
    const handler = () => {
      _defaultId = null;
      _fails     = 0;
      _fetchLive();
    };
    window.addEventListener("rg_account_changed", handler);
    return () => window.removeEventListener("rg_account_changed", handler);
  }, []);

  return state;
}

// â”€â”€ Export helper so other components can trigger a refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function refreshLiveData() {
  _defaultId = null;
  _fails     = 0;
  _fetchLive();
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function safeNum(v: any, fallback = 0): number {
  const n = parseFloat(v);
  return isFinite(n) ? n : fallback;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}




