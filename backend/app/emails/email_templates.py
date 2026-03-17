"""
email_templates.py — World-class dark premium design for RiskGuardian
"""

BASE_STYLE = """
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#060a14; font-family:'Segoe UI',Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
.wrapper { max-width:600px; margin:0 auto; padding:24px 12px 48px; }
.outer { border-radius:24px; overflow:hidden; box-shadow:0 32px 80px rgba(0,0,0,0.7); }

/* ── Top nav bar ── */
.navbar { background:#0a0f1e; padding:18px 32px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.06); }
.logo { font-size:20px; font-weight:900; color:#fff; letter-spacing:-0.03em; }
.logo span { color:#22c55e; }
.nav-badge { background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; padding:5px 12px; border-radius:20px; }

/* ── Hero ── */
.hero { position:relative; overflow:hidden; padding:28px 40px 28px; text-align:center; }
.hero-icon { font-size:52px; display:block; margin-bottom:14px; }
.hero h1 { font-size:38px; font-weight:900; color:#fff; line-height:1.1; margin-bottom:14px; letter-spacing:-0.02em; }
.hero h1 .highlight { display:inline-block; background:linear-gradient(90deg,#38bdf8,#22c55e); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.hero p { font-size:16px; color:rgba(255,255,255,0.55); line-height:1.7; max-width:400px; margin:0 auto; }

/* ── Body ── */
.body { background:#0d1526; padding:40px 36px; }
.body-text { font-size:15px; color:rgba(255,255,255,0.6); line-height:1.8; margin-bottom:28px; }
.body-text strong { color:#fff; font-weight:700; }

/* ── Section label ── */
.section-label { font-size:11px; font-weight:800; color:rgba(255,255,255,0.25); letter-spacing:0.15em; text-transform:uppercase; margin-bottom:16px; }

/* ── Step cards ── */
.steps { display:flex; gap:10px; margin-bottom:32px; }
.step { flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px 12px; text-align:center; }
.step-num { width:28px; height:28px; border-radius:50%; font-size:12px; font-weight:900; color:#fff; text-align:center; line-height:28px; margin:0 auto 10px; display:block; }
.step-emoji { font-size:28px; display:block; margin-bottom:10px; }
.step-title { font-size:12px; font-weight:800; color:#fff; margin-bottom:4px; }
.step-desc { font-size:11px; color:rgba(255,255,255,0.35); line-height:1.4; }

/* ── CTA Button ── */
.btn-wrap { text-align:center; margin:32px 0; }
.btn { display:inline-block; padding:18px 48px; font-size:16px; font-weight:800; color:#fff !important; text-decoration:none; border-radius:14px; letter-spacing:0.01em; }
.btn-green    { background:linear-gradient(135deg,#059669,#22c55e); box-shadow:0 8px 32px rgba(34,197,94,0.4); }
.btn-purple   { background:linear-gradient(135deg,#7c3aed,#3b82f6); box-shadow:0 8px 32px rgba(124,58,237,0.4); }
.btn-blue     { background:linear-gradient(135deg,#2563eb,#38bdf8); box-shadow:0 8px 32px rgba(37,99,235,0.4); }
.btn-telegram { background:linear-gradient(135deg,#0088cc,#38bdf8); box-shadow:0 8px 32px rgba(0,136,204,0.4); }

/* ── Feature list ── */
.features { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:8px 0; margin-bottom:28px; }
.feature-row { display:flex; align-items:center; gap:14px; padding:14px 20px; border-bottom:1px solid rgba(255,255,255,0.05); }
.feature-row:last-child { border-bottom:none; }
.f-check { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; color:#fff; flex-shrink:0; background:linear-gradient(135deg,#059669,#22c55e); }
.f-text { font-size:13px; color:rgba(255,255,255,0.7); flex:1; font-weight:500; }
.f-badge { font-size:10px; font-weight:800; padding:3px 9px; border-radius:10px; white-space:nowrap; }
.badge-pro  { background:rgba(168,85,247,0.15); color:#a855f7; border:1px solid rgba(168,85,247,0.3); }
.badge-free { background:rgba(34,197,94,0.12);  color:#22c55e; border:1px solid rgba(34,197,94,0.25); }
.badge-time { background:rgba(56,189,248,0.1);  color:#38bdf8; border:1px solid rgba(56,189,248,0.2); }

/* ── Stats ── */
.stats { display:flex; gap:10px; margin-bottom:28px; }
.stat { flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px 12px; text-align:center; }
.stat-val { font-size:30px; font-weight:900; font-family:monospace; line-height:1; margin-bottom:4px; }
.stat-lbl { font-size:10px; font-weight:700; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:0.1em; }

/* ── Upgrade box ── */
.upgrade-box { border-radius:18px; padding:28px; text-align:center; margin-bottom:28px; position:relative; overflow:hidden; }
.upgrade-box h3 { font-size:22px; font-weight:900; color:#fff; margin-bottom:8px; }
.upgrade-box p { font-size:14px; color:rgba(255,255,255,0.5); line-height:1.7; margin-bottom:22px; }
.upgrade-perks { display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:22px; }
.perk { font-size:11px; font-weight:700; color:rgba(255,255,255,0.6); background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:20px; padding:5px 12px; }

/* ── Telegram CTA box ── */
.telegram-box {
  border-radius:18px; padding:28px; text-align:center; margin-bottom:28px;
  background:linear-gradient(135deg,rgba(0,136,204,0.12),rgba(56,189,248,0.07));
  border:1px solid rgba(0,136,204,0.3); position:relative; overflow:hidden;
}
.telegram-box::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,#0088cc,#38bdf8,transparent);
}
.telegram-box h3 { font-size:20px; font-weight:900; color:#fff; margin-bottom:8px; }
.telegram-box p { font-size:14px; color:rgba(255,255,255,0.5); line-height:1.7; margin-bottom:20px; }
.telegram-steps { display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:22px; }
.telegram-step {
  font-size:11px; font-weight:700; color:rgba(56,189,248,0.9);
  background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.2);
  border-radius:20px; padding:5px 12px;
}

/* ── Warning box ── */
.warn { background:rgba(245,158,11,0.08); border-left:3px solid #f59e0b; border-radius:0 12px 12px 0; padding:16px 18px; margin-bottom:24px; }
.warn p { font-size:13px; color:rgba(245,158,11,0.9); line-height:1.7; font-weight:500; }

/* ── Quote ── */
.quote { background:rgba(34,197,94,0.06); border:1px solid rgba(34,197,94,0.15); border-radius:16px; padding:24px; margin-bottom:28px; }
.quote p { font-size:14px; color:rgba(255,255,255,0.65); line-height:1.7; font-style:italic; margin-bottom:10px; }
.quote-author { font-size:12px; font-weight:700; color:#22c55e; }
.quote-stars { color:#f59e0b; font-size:13px; margin-bottom:8px; }

/* ── Divider ── */
.divider { height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent); margin:28px 0; }

/* ── PnL hero number ── */
.pnl-hero { text-align:center; padding:28px 0; border-bottom:1px solid rgba(255,255,255,0.06); margin-bottom:28px; }
.pnl-label { font-size:11px; font-weight:800; color:rgba(255,255,255,0.25); letter-spacing:0.15em; text-transform:uppercase; margin-bottom:8px; }
.pnl-number { font-size:56px; font-weight:900; font-family:monospace; line-height:1; }
.pnl-pct { font-size:16px; font-weight:700; margin-top:6px; }

/* ── Stat rows ── */
.stat-rows { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:4px 0; margin-bottom:24px; }
.srow { display:flex; justify-content:space-between; align-items:center; padding:13px 20px; border-bottom:1px solid rgba(255,255,255,0.05); }
.srow:last-child { border-bottom:none; }
.srow-label { font-size:13px; color:rgba(255,255,255,0.4); }
.srow-val { font-size:13px; font-weight:800; font-family:monospace; color:#fff; }

/* ── Footer ── */
.footer { background:#060a14; padding:28px 32px; text-align:center; }
.footer p { font-size:11px; color:rgba(255,255,255,0.18); line-height:1.9; }
.footer a { color:rgba(56,189,248,0.5); text-decoration:none; }
.footer-divider { height:1px; background:rgba(255,255,255,0.05); margin:12px 0; }
"""


def _wrap(content: str, preheader: str = "", frontend_url: str = "", plan_label: str = "Free Plan") -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>RiskGuardian</title>
  <style>{BASE_STYLE}</style>
</head>
<body>
  {'<div style="display:none;max-height:0;overflow:hidden;color:#060a14;">'+preheader+'&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>' if preheader else ''}
  <div class="wrapper">
    <div class="outer">

      <!-- Navbar -->
      <div class="navbar">
        <div>
          <div class="logo">Risk<span>Guardian</span></div>
          <div style="font-size:9px;color:rgba(255,255,255,0.25);letter-spacing:0.14em;text-transform:uppercase;margin-top:2px;">Professional Risk Management</div>
        </div>
        <div class="nav-badge">{plan_label}</div>
      </div>

      {content}

      <!-- Footer -->
      <div class="footer">
        <div class="footer-divider"></div>
        <p>
          You received this because you signed up for RiskGuardian.<br/>
          <a href="{frontend_url}/#/app/settings">Manage notifications</a>
          &nbsp;·&nbsp;
          <a href="{frontend_url}/#/unsubscribe">Unsubscribe</a>
        </p>
        <p style="margin-top:8px;color:rgba(255,255,255,0.08);">
          &copy; 2026 RiskGuardian &middot; Built for disciplined traders worldwide
        </p>
      </div>

    </div>
  </div>
</body>
</html>"""


# ══════════════════════════════════════════════════════════════
# EMAIL 1 — WELCOME
# ══════════════════════════════════════════════════════════════
def get_welcome_email(username: str, frontend_url: str, telegram_link: str = "") -> tuple[str, str]:
    """
    Welcome email sent immediately after signup.

    Args:
        username:       The new user's display name.
        frontend_url:   Base URL of the frontend (e.g. http://192.168.43.131:3000).
        telegram_link:  Optional personal t.me deep-link from generate_connect_link(user.id).
                        When provided, a prominent Telegram CTA block is injected.

    Usage in signup route:
        from app.routes.telegram import generate_connect_link
        tg_link = generate_connect_link(new_user.id)
        subject, html = get_welcome_email(new_user.username, FRONTEND_URL, tg_link)
        send_email(new_user.email, subject, html)
    """
    telegram_block = ""
    if telegram_link:
        telegram_block = f"""
      <div class="telegram-box">
        <div style="font-size:40px;margin-bottom:12px;">✈️</div>
        <div style="font-size:11px;font-weight:800;color:#38bdf8;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:10px;">
          &#9889; Connect Telegram Alerts
        </div>
        <h3>Get risk alerts on your phone</h3>
        <p>
          When your kill switch fires or daily limit is hit, we ping you on Telegram
          <em>instantly</em> — no app required, no manual setup.  Takes 10 seconds.
        </p>
        <div class="telegram-steps">
          <span class="telegram-step">1&#65039;&#8419; Click the button below</span>
          <span class="telegram-step">2&#65039;&#8419; Press START in Telegram</span>
          <span class="telegram-step">3&#65039;&#8419; Done &#10003;</span>
        </div>
        <a href="{telegram_link}" class="btn btn-telegram" style="padding:16px 40px;font-size:15px;">
          &#9992;&#65039; &nbsp; Connect Telegram &mdash; 10 seconds
        </a>
        <p style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:14px;margin-bottom:0;">
          You can also connect later from
          <a href="{frontend_url}/#/app/settings" style="color:#38bdf8;">Settings &rarr; Notifications</a>
        </p>
      </div>"""

    subject = f"Welcome to RiskGuardian, {username} \u2014 you're protected \U0001f6e1\ufe0f"
    content = f"""
    <!-- Hero -->
    <div class="hero" style="background:linear-gradient(160deg,#0a0f1e 0%,#0d2247 40%,#0a1f15 100%);">
      <span class="hero-icon">&#127919;</span>
      <h1>Welcome aboard,<br/><span class="highlight">{username}!</span></h1>
      <p>You've just joined the smarter way to trade. We protect your capital
         so you can focus on what matters &mdash; your strategy.</p>
    </div>

    <!-- Body -->
    <div class="body">
      <p class="body-text">
        RiskGuardian watches your trades 24/7, enforces your risk rules automatically,
        and activates the <strong>Risk Lock</strong> the moment you're about to cross your limits.
        <strong>Most traders reduce their drawdown by over 30% in their first week.</strong>
      </p>

      <div class="section-label">Get protected in 3 steps</div>
      <div class="steps">
        <div class="step">
          <span class="step-emoji">&#128421;&#65039;</span>
          <div class="step-num" style="background:linear-gradient(135deg,#2563eb,#38bdf8);">1</div>
          <div class="step-title">Connect MT5</div>
          <div class="step-desc">Link your trading account</div>
        </div>
        <div class="step">
          <span class="step-emoji">&#128737;&#65039;</span>
          <div class="step-num" style="background:linear-gradient(135deg,#059669,#22c55e);">2</div>
          <div class="step-title">Set Limits</div>
          <div class="step-desc">Daily loss &amp; drawdown rules</div>
        </div>
        <div class="step">
          <span class="step-emoji">&#128274;</span>
          <div class="step-num" style="background:linear-gradient(135deg,#7c3aed,#a855f7);">3</div>
          <div class="step-title">Try Risk Lock</div>
          <div class="step-desc">Block impulsive trades</div>
        </div>
      </div>

      <div class="btn-wrap">
        <a href="{frontend_url}/#/app" class="btn btn-green">Open My Dashboard &rarr;</a>
      </div>

      {telegram_block}

      <div class="quote">
        <div class="quote-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p>&ldquo;RiskGuardian stopped me from blowing my prop firm challenge twice.
        The Risk Lock feature alone is worth every penny. I passed FTMO on my
        next attempt after using this.&rdquo;</p>
        <div class="quote-author">&mdash; James K., Prop Trader &middot; 3-month subscriber</div>
      </div>

      <div class="divider"></div>
      <p style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;">
        Questions? Just reply to this email &mdash; we read every one. &#128172;
      </p>
    </div>
    """
    return subject, _wrap(
        content,
        preheader=f"Welcome {username} \u2014 your trading account is now monitored 24/7",
        frontend_url=frontend_url,
    )


# ══════════════════════════════════════════════════════════════
# EMAIL 2 — DAY 3 NUDGE
# ══════════════════════════════════════════════════════════════
def get_day3_nudge_email(username: str, frontend_url: str) -> tuple[str, str]:
    subject = f"{username}, your account isn't protected yet \u26a0\ufe0f"
    content = f"""
    <!-- Hero -->
    <div class="hero" style="background:linear-gradient(160deg,#0f0a00 0%,#2d1500 40%,#1a0a00 100%);">
      <span class="hero-icon">&#9888;&#65039;</span>
      <h1>Your account is<br/><span class="highlight" style="background:linear-gradient(90deg,#f59e0b,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">unprotected</span></h1>
      <p>You signed up 3 days ago but haven't finished setting up your risk rules.
         One bad trading day without limits can wipe your account.</p>
    </div>

    <div class="body">
      <div class="warn">
        <p>&#9888;&#65039; <strong style="color:#f59e0b;">Prop firm traders especially:</strong> without daily loss limits set,
        a single emotional session can fail your challenge and cost you hundreds of dollars.</p>
      </div>

      <div class="section-label">Complete your setup &mdash; takes 5 minutes</div>
      <div class="features">
        <div class="feature-row">
          <div class="f-check" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);">&rarr;</div>
          <span class="f-text">&#128421;&#65039; Connect your MetaTrader 5 account</span>
          <span class="f-badge badge-time">5 min</span>
        </div>
        <div class="feature-row">
          <div class="f-check" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);">&rarr;</div>
          <span class="f-text">&#128737;&#65039; Set your daily loss limit</span>
          <span class="f-badge badge-time">1 min</span>
        </div>
        <div class="feature-row">
          <div class="f-check" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);">&rarr;</div>
          <span class="f-text">&#128274; Activate your first Risk Lock</span>
          <span class="f-badge badge-time">30 sec</span>
        </div>
        <div class="feature-row">
          <div class="f-check" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);">&rarr;</div>
          <span class="f-text">&#128212; Write your first journal entry</span>
          <span class="f-badge badge-time">2 min</span>
        </div>
      </div>

      <div class="btn-wrap">
        <a href="{frontend_url}/#/app" class="btn btn-blue">Complete My Setup &rarr;</a>
      </div>

      <div class="quote">
        <div class="quote-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p>&ldquo;I set up my risk limits in literally 3 minutes. Haven't blown a funded account
        since. Wish I had this tool 2 years ago when I started.&rdquo;</p>
        <div class="quote-author">&mdash; Sarah M., Forex Trader &middot; 6-month subscriber</div>
      </div>
    </div>
    """
    return subject, _wrap(
        content,
        preheader=f"{username} \u2014 your trading account still has no risk limits set",
        frontend_url=frontend_url,
    )


# ══════════════════════════════════════════════════════════════
# EMAIL 3 — DAY 7 UPGRADE PUSH
# ══════════════════════════════════════════════════════════════
def get_day7_upgrade_email(username: str, frontend_url: str) -> tuple[str, str]:
    subject = f"What Pro traders see that you don't, {username} \u26a1"
    content = f"""
    <!-- Hero -->
    <div class="hero" style="background:linear-gradient(160deg,#0f0a1e 0%,#1e0d4e 40%,#0a0f2e 100%);">
      <span class="hero-icon">&#9889;</span>
      <h1>One week in.<br/><span class="highlight" style="background:linear-gradient(90deg,#a855f7,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Time to level up.</span></h1>
      <p>You've seen what RiskGuardian can do on the Free plan.
         Here's what Pro traders have that you're missing.</p>
    </div>

    <div class="body">
      <div class="section-label">Pro traders see real results</div>
      <div class="stats" style="margin-bottom:32px;">
        <div class="stat">
          <div class="stat-val" style="color:#22c55e;">34%</div>
          <div class="stat-lbl">Less drawdown</div>
        </div>
        <div class="stat">
          <div class="stat-val" style="color:#38bdf8;">2.4x</div>
          <div class="stat-lbl">More consistent</div>
        </div>
        <div class="stat">
          <div class="stat-val" style="color:#a855f7;">87%</div>
          <div class="stat-lbl">Prop pass rate</div>
        </div>
      </div>

      <div class="section-label">What you unlock with Pro</div>
      <div class="features">
        <div class="feature-row">
          <div class="f-check">&#10003;</div>
          <span class="f-text">&#129302; AI Journal &mdash; weekly pattern analysis on your trades</span>
          <span class="f-badge badge-pro">PRO</span>
        </div>
        <div class="feature-row">
          <div class="f-check">&#10003;</div>
          <span class="f-text">&#128241; Telegram alerts &mdash; risk warnings on your phone</span>
          <span class="f-badge badge-pro">PRO</span>
        </div>
        <div class="feature-row">
          <div class="f-check">&#10003;</div>
          <span class="f-text">&#128421;&#65039; 3 MT5 accounts &mdash; manage all your challenges</span>
          <span class="f-badge badge-pro">PRO</span>
        </div>
        <div class="feature-row">
          <div class="f-check">&#10003;</div>
          <span class="f-text">&#128200; Advanced analytics &mdash; 90 days full trade history</span>
          <span class="f-badge badge-pro">PRO</span>
        </div>
        <div class="feature-row">
          <div class="f-check">&#10003;</div>
          <span class="f-text">&#127942; Prop firm profiles &mdash; FTMO, MyForexFunds &amp; more</span>
          <span class="f-badge badge-pro">PRO</span>
        </div>
      </div>

      <div class="upgrade-box" style="background:linear-gradient(135deg,rgba(124,58,237,0.15),rgba(59,130,246,0.1));border:1px solid rgba(168,85,247,0.25);">
        <div style="font-size:11px;font-weight:800;color:#a855f7;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">&#9889; Pro Plan &middot; $49/month</div>
        <h3>Upgrade to Pro today</h3>
        <p>Join hundreds of traders who passed their prop firm challenges
        using RiskGuardian Pro. Cancel anytime &mdash; no contracts, no risk.</p>
        <div class="upgrade-perks">
          <span class="perk">&#10003; Instant activation</span>
          <span class="perk">&#10003; Cancel anytime</span>
          <span class="perk">&#10003; No contracts</span>
        </div>
        <a href="{frontend_url}/#/app/settings" class="btn btn-purple">Upgrade to Pro &mdash; $49/mo &rarr;</a>
      </div>

      <div class="quote">
        <div class="quote-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p>&ldquo;The AI journal feature changed everything. It spotted that I was
        consistently over-trading on Mondays and losing 60% of my weekly profit
        in the first hour. Fixed that one habit and became profitable.&rdquo;</p>
        <div class="quote-author">&mdash; Marcus T., Full-time Trader &middot; Pro subscriber</div>
      </div>
    </div>
    """
    return subject, _wrap(
        content,
        preheader="Pro traders have a 34% lower drawdown \u2014 unlock everything for $49/mo",
        frontend_url=frontend_url,
    )


# ══════════════════════════════════════════════════════════════
# EMAIL 4 — WEEKLY DIGEST
# ══════════════════════════════════════════════════════════════
def get_weekly_digest_email(username: str, stats: dict, frontend_url: str) -> tuple[str, str]:
    import datetime

    pnl        = stats.get("weekly_pnl", 0)
    pnl_pct    = stats.get("weekly_pnl_pct", 0)
    trades     = stats.get("total_trades", 0)
    win_rate   = stats.get("win_rate", 0)
    locks_used = stats.get("risk_locks_used", 0)
    best_day   = stats.get("best_day", "N/A")
    worst_day  = stats.get("worst_day", "N/A")
    risk_score = stats.get("risk_score", 0)

    pnl_color   = "#22c55e" if pnl >= 0 else "#ef4444"
    pnl_str     = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"
    pnl_pct_str = f"+{pnl_pct:.1f}%" if pnl_pct >= 0 else f"{pnl_pct:.1f}%"
    risk_color  = "#22c55e" if risk_score < 40 else "#f59e0b" if risk_score < 70 else "#ef4444"
    risk_label  = "Low Risk \U0001f7e2" if risk_score < 40 else "Medium \u26a0\ufe0f" if risk_score < 70 else "High Risk \U0001f534"
    week_str    = datetime.date.today().strftime("%B %d, %Y")

    subject = f"Your RiskGuardian week \u2014 {pnl_str} \u00b7 {week_str}"

    upgrade_nudge = ""
    if locks_used >= 2:
        upgrade_nudge = f"""
        <div class="upgrade-box" style="background:linear-gradient(135deg,rgba(124,58,237,0.1),rgba(59,130,246,0.08));border:1px solid rgba(168,85,247,0.2);margin-top:8px;">
          <div style="font-size:28px;margin-bottom:12px;">&#129302;</div>
          <h3 style="font-size:18px;">Unlock AI Journal Analysis</h3>
          <p>You activated Risk Lock {locks_used}x this week. Upgrade to Pro and our AI will
          analyze <em>why</em> you needed it and how to prevent it next week.</p>
          <a href="{frontend_url}/#/app/settings" class="btn btn-purple" style="padding:14px 32px;font-size:14px;">
            Upgrade to Pro &rarr;
          </a>
        </div>"""

    content = f"""
    <div class="hero" style="background:linear-gradient(160deg,#0a0f1e 0%,#0d2247 40%,#0a1f15 100%);">
      <span class="hero-icon">&#128202;</span>
      <h1>Your week<br/><span class="highlight">in review</span></h1>
      <p>Week ending {week_str} &middot; Stay disciplined, {username}.</p>
    </div>

    <div class="body">
      <div class="pnl-hero">
        <div class="pnl-label">Weekly P&amp;L</div>
        <div class="pnl-number" style="color:{pnl_color};">{pnl_str}</div>
        <div class="pnl-pct" style="color:{pnl_color};">{pnl_pct_str}</div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-val" style="color:#38bdf8;">{trades}</div>
          <div class="stat-lbl">Trades</div>
        </div>
        <div class="stat">
          <div class="stat-val" style="color:#22c55e;">{win_rate:.0f}%</div>
          <div class="stat-lbl">Win Rate</div>
        </div>
        <div class="stat">
          <div class="stat-val" style="color:#f59e0b;">{locks_used}x</div>
          <div class="stat-lbl">Risk Locks</div>
        </div>
      </div>

      <div class="stat-rows">
        <div class="srow">
          <span class="srow-label">&#127942; Best Day</span>
          <span class="srow-val" style="color:#22c55e;">{best_day}</span>
        </div>
        <div class="srow">
          <span class="srow-label">&#128201; Worst Day</span>
          <span class="srow-val" style="color:#ef4444;">{worst_day}</span>
        </div>
        <div class="srow">
          <span class="srow-label">&#128737;&#65039; Risk Score</span>
          <span class="srow-val" style="color:{risk_color};">{risk_score} &mdash; {risk_label}</span>
        </div>
      </div>

      {upgrade_nudge}

      <div class="btn-wrap">
        <a href="{frontend_url}/#/app" class="btn btn-green">View Full Dashboard &rarr;</a>
      </div>

      <div class="divider"></div>
      <p style="font-size:13px;color:rgba(255,255,255,0.25);text-align:center;line-height:1.7;">
        Consistency beats perfection every time. Keep showing up. &#128170;
      </p>
    </div>
    """
    return subject, _wrap(
        content,
        preheader=f"Your weekly trading summary is ready \u2014 {pnl_str} this week",
        frontend_url=frontend_url,
    )


# ══════════════════════════════════════════════════════════════
# EMAIL 5 — TRIAL STARTED
# ══════════════════════════════════════════════════════════════
def get_trial_started_email(username: str, days: int, frontend_url: str, telegram_link: str = "") -> tuple[str, str]:
    """
    Sent when a user activates a Pro trial.
    Pass telegram_link to nudge them to connect Telegram while they have access.
    """
    telegram_block = ""
    if telegram_link:
        telegram_block = f"""
      <div class="telegram-box" style="margin-top:4px;">
        <div style="font-size:32px;margin-bottom:10px;">&#9992;&#65039;</div>
        <div style="font-size:11px;font-weight:800;color:#38bdf8;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:10px;">
          Connect Telegram Now
        </div>
        <h3 style="font-size:18px;">Your first Pro perk &mdash; instant alerts</h3>
        <p>You now have Telegram alerts unlocked. Set them up in 10 seconds while you're here.</p>
        <a href="{telegram_link}" class="btn btn-telegram" style="padding:14px 36px;font-size:14px;">
          &#9992;&#65039; &nbsp; Connect Telegram
        </a>
      </div>"""

    subject = f"Your {days}-day Pro trial is live, {username} \u26a1"
    content = f"""
    <div class="hero" style="background:linear-gradient(160deg,#0f0a1e 0%,#1e0d4e 40%,#0a0f2e 100%);">
      <span class="hero-icon">&#9889;</span>
      <h1>Your Pro trial<br/><span class="highlight" style="background:linear-gradient(90deg,#a855f7,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">is live!</span></h1>
      <p>You have full Pro access for the next {days} days &mdash; no credit card needed. Make the most of it.</p>
    </div>

    <div class="body">
      <div style="background:linear-gradient(135deg,rgba(168,85,247,0.12),rgba(56,189,248,0.08));border:1px solid rgba(168,85,247,0.25);border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;">
        <div style="font-size:48px;font-weight:900;color:#a855f7;font-family:monospace;line-height:1;">{days}</div>
        <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">Days of Pro Access</div>
      </div>

      <div class="section-label">Everything unlocked for you</div>
      <div class="features">
        <div class="feature-row"><div class="f-check">&#10003;</div><span class="f-text">&#129302; AI Trading Journal &mdash; pattern analysis</span></div>
        <div class="feature-row"><div class="f-check">&#10003;</div><span class="f-text">&#128241; Telegram alerts on your phone</span></div>
        <div class="feature-row"><div class="f-check">&#10003;</div><span class="f-text">&#128421;&#65039; Up to 3 MT5 accounts</span></div>
        <div class="feature-row"><div class="f-check">&#10003;</div><span class="f-text">&#128200; 90-day trade history &amp; analytics</span></div>
        <div class="feature-row"><div class="f-check">&#10003;</div><span class="f-text">&#127942; Prop firm challenge profiles</span></div>
      </div>

      {telegram_block}

      <div class="btn-wrap">
        <a href="{frontend_url}/#/app" class="btn btn-purple">Explore Pro Features &rarr;</a>
      </div>

      <div class="quote">
        <div class="quote-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p>&ldquo;I activated the trial on a Monday. By Friday I had set up Telegram alerts,
        connected 2 accounts, and passed my FTMO phase 1. Subscribed immediately.&rdquo;</p>
        <div class="quote-author">&mdash; David R., Prop Trader</div>
      </div>

      <div class="divider"></div>
      <p style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;line-height:1.7;">
        Trial ends in {days} days. Upgrade anytime at
        <a href="{frontend_url}/#/app/settings" style="color:#a855f7;">Settings &rarr; Billing</a>
      </p>
    </div>
    """
    return subject, _wrap(
        content,
        preheader=f"{days}-day Pro trial activated \u2014 all features unlocked",
        frontend_url=frontend_url,
        plan_label="Pro Trial",
    )


# ══════════════════════════════════════════════════════════════
# EMAIL 6 — TRIAL EXPIRED
# ══════════════════════════════════════════════════════════════
def get_trial_expired_email(username: str, frontend_url: str) -> tuple[str, str]:
    subject = f"Your Pro trial has ended, {username} \u2014 keep your progress \U0001f512"
    content = f"""
    <div class="hero" style="background:linear-gradient(160deg,#0f0a00 0%,#2d1500 40%,#1a0a00 100%);">
      <span class="hero-icon">&#9200;</span>
      <h1>Your trial has<br/><span class="highlight" style="background:linear-gradient(90deg,#f59e0b,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">ended</span></h1>
      <p>Your 7-day Pro trial is over, {username}. Your account is back on the Free plan &mdash;
         but it only takes one click to get everything back.</p>
    </div>

    <div class="body">
      <div class="warn">
        <p>&#9888;&#65039; <strong style="color:#f59e0b;">You've lost access to:</strong> AI Journal, Telegram alerts,
        multiple MT5 accounts, 90-day history, and prop firm profiles.
        Upgrade now to keep all your data and settings.</p>
      </div>

      <div class="upgrade-box" style="background:linear-gradient(135deg,rgba(124,58,237,0.15),rgba(59,130,246,0.1));border:1px solid rgba(168,85,247,0.25);">
        <div style="font-size:11px;font-weight:800;color:#a855f7;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">&#9889; Special Offer</div>
        <h3>Get 1 month for $39</h3>
        <p>As a trial user, get your first month of Pro at <strong style="color:#fff;">$39 instead of $49</strong>.
        This offer expires in 48 hours.</p>
        <div class="upgrade-perks">
          <span class="perk">&#10003; Instant activation</span>
          <span class="perk">&#10003; Cancel anytime</span>
          <span class="perk">&#10003; Keep all your data</span>
        </div>
        <a href="{frontend_url}/#/app/settings" class="btn btn-purple">Upgrade Now &mdash; $39/mo &rarr;</a>
        <p style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:12px;margin-bottom:0;">Offer expires in 48 hours</p>
      </div>

      <div class="quote">
        <div class="quote-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
        <p>&ldquo;After my trial ended I upgraded immediately. The AI journal alone
        identified 3 bad habits I didn't even know I had. Best $49 I spend every month.&rdquo;</p>
        <div class="quote-author">&mdash; Lisa M., Full-time Trader</div>
      </div>
    </div>
    """
    return subject, _wrap(
        content,
        preheader="Your trial ended \u2014 upgrade at $39 for 48 hours only",
        frontend_url=frontend_url,
    )