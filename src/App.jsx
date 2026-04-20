import { useEffect, useMemo, useState } from "react";

const navItems = [
  { href: "/", label: "Support Home" },
  { href: "/troubleshooting", label: "Troubleshooting" },
  { href: "/known-issues", label: "Known Issues" },
  { href: "/report-bug", label: "Report a Bug" },
  { href: "/community", label: "Community" },
  { href: "/status", label: "Status" },
];

const routeMeta = {
  "/": {
    eyebrow: "Support center",
    title: "Help for install, overlays, and creator tools.",
    copy: "Use docs for setup, troubleshooting for common issues, and bug reports for reproducible problems.",
  },
  "/troubleshooting": {
    eyebrow: "Troubleshooting",
    title: "Check the common fixes first.",
    copy: "Fast checks for install, capture, input, performance, and creator integrations.",
  },
  "/known-issues": {
    eyebrow: "Known issues",
    title: "Current known issues.",
    copy: "A short list of issues we already know about in the release build.",
  },
  "/report-bug": {
    eyebrow: "Bug intake",
    title: "Send a bug report.",
    copy: "Use this form for reproducible issues. It still posts to the existing intake API.",
  },
  "/community": {
    eyebrow: "Community",
    title: "Other ways to reach us.",
    copy: "Use docs, Steam, or email while community channels are being consolidated.",
  },
  "/status": {
    eyebrow: "Status",
    title: "Support and service status.",
    copy: "This is where we point users during outages or support changes.",
  },
};

const homeLinks = [
  {
    href: "https://docs.vros.cat/",
    title: "Docs",
    copy: "Install, first run, overlays, and release notes.",
  },
  {
    href: "/troubleshooting",
    title: "Troubleshooting",
    copy: "Quick checks for install, capture, input, and creator tools.",
  },
  {
    href: "/report-bug",
    title: "Report a bug",
    copy: "Send a reproducible issue to the bug intake pipeline.",
  },
  {
    href: "/status",
    title: "Status",
    copy: "See current support and service notes.",
  },
];

const troubleshootCards = [
  {
    title: "vrOS is installed but no overlay appears in SteamVR.",
    steps: [
      "Restart SteamVR after the first install or after an update.",
      "Launch vrOS from the desktop control center and confirm the runtime is active.",
      "Check SteamVR startup and shutdown settings for the vrOS entry.",
      "If nothing appears, reboot SteamVR before changing overlay layouts.",
    ],
  },
  {
    title: "A capture overlay is black, frozen, or missing content.",
    steps: [
      "Confirm the source window is visible and not minimized.",
      "Protected or DRM video sources can fail in capture overlays; test with a normal desktop app first.",
      "Restart the source app and recreate the capture surface if the first attach failed.",
      "If performance drops, reduce the number of active capture overlays.",
    ],
  },
  {
    title: "Keyboard or pointer input is landing in the wrong place.",
    steps: [
      "Click or focus the target window from the desktop control center first.",
      "Re-open the keyboard overlay after switching between apps.",
      "Keep vrOS and the target app at the same Windows privilege level when possible.",
      "If an overlay stops responding, rebuild that overlay instead of restarting the whole stack first.",
    ],
  },
  {
    title: "Performance drops when multiple overlays are active.",
    steps: [
      "Start with fewer active overlays and bring them back one at a time.",
      "Lower capture count or resolution before lowering SteamVR quality globally.",
      "Close unused creator tools and heavy desktop apps in the background.",
      "Update GPU drivers and verify SteamVR motion settings if stutter persists.",
    ],
  },
  {
    title: "OBS, Twitch, or VRChat services are not connecting.",
    steps: [
      "Re-check credentials, local service availability, and firewall rules from the desktop control center.",
      "Reconnect the integration instead of assuming the stored session is still valid.",
      "Make sure OBS is already running before connecting scene or source controls.",
      "If a workflow still fails, include the exact integration and step sequence in your bug report.",
    ],
  },
];

const knownIssues = [
  {
    title: "First-run SteamVR restart",
    tone: "warning",
    copy: "Some first installs need a full SteamVR restart before the dashboard entry and overlay surfaces stabilize.",
  },
  {
    title: "Protected media capture",
    tone: "warning",
    copy: "Some protected video or browser content can render black in capture overlays even when normal desktop apps work.",
  },
  {
    title: "Privilege mismatch and input routing",
    tone: "primary",
    copy: "If vrOS and the target app run at different Windows privilege levels, focus and input forwarding can become inconsistent.",
  },
  {
    title: "Heavy multi-overlay layouts",
    tone: "primary",
    copy: "Large capture-heavy layouts can need lower overlay count or lower source resolution on midrange GPUs.",
  },
];

const statusCards = [
  {
    title: "Support site",
    value: "support.vros.cat",
    copy: "Public support navigation, troubleshooting, and community routing.",
  },
  {
    title: "Docs site",
    value: "docs.vros.cat",
    copy: "Install, setup, release notes, and product guidance.",
  },
  {
    title: "Bug intake API",
    value: "api.vros.cat",
    copy: "Compatibility surface used by the report form while release support is being rebuilt.",
  },
  {
    title: "Release delivery",
    value: "Steam store",
    copy: "Users install vrOS from the Steam release surface and return here for support.",
  },
];

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";

  const cleanPath = pathname.replace(/\/+$/, "");
  const aliases = {
    "/report-bug.html": "/report-bug",
    "/bugs": "/report-bug",
    "/activity": "/known-issues",
    "/stats": "/status",
  };

  return aliases[cleanPath] || cleanPath;
}

function getAppToken() {
  const fallback = `vros-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    const existing = window.localStorage.getItem("vros-app-token");
    if (existing) return existing;
    window.localStorage.setItem("vros-app-token", fallback);
  } catch {
    return fallback;
  }

  return fallback;
}

function detectSystemInfo() {
  const params = new URLSearchParams(window.location.search);
  const platform = navigator.userAgentData?.platform || navigator.platform || "Unknown";
  const userAgent = navigator.userAgent;
  const os = /Win/i.test(platform)
    ? "Windows"
    : /Mac/i.test(platform)
      ? "macOS"
      : /Linux/i.test(platform)
        ? "Linux"
        : platform;

  let browser = "Unknown";
  if (userAgent.includes("Edg")) browser = "Edge";
  else if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";

  return {
    os,
    browser,
    version: params.get("version") || window.sessionStorage.getItem("app-version") || "Not provided",
    headset: params.get("headset") || "Not provided",
    resolution: `${window.screen.width}x${window.screen.height}`,
    fromApp: params.get("from") === "app",
  };
}

function NavLink({ href, label, currentPath }) {
  const active = currentPath === href;

  return (
    <a
      className={`sidebar-link${active ? " is-active" : ""}`}
      href={href}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </a>
  );
}

function HomePage() {
  return (
    <div className="content-stack">
      <article className="hero-card vros-card" data-raised="true">
        <div className="hero-card-copy">
          <span className="vros-badge" data-tone="success">
            Support
          </span>
          <h2 className="type-h1">Help for install, overlays, and creator tools.</h2>
          <p className="type-body">
            Start with docs or troubleshooting. Use the bug form for reproducible problems.
          </p>
          <div className="hero-card-actions">
            <a className="vros-btn" data-variant="primary" href="/report-bug">
              <span className="vros-btn-label">Report a bug</span>
            </a>
            <a className="vros-btn" data-variant="secondary" href="https://docs.vros.cat/">
              <span className="vros-btn-label">Open docs</span>
            </a>
          </div>
        </div>
        <div className="hero-card-image support-brand-panel" aria-label="vrOS support brand panel">
          <div className="support-brand-head">
            <span className="vros-badge" data-tone="primary">
              Support surface
            </span>
            <span className="type-mono support-brand-route">support.vros.cat</span>
          </div>
          <div className="support-brand-stage">
            <div className="support-brand-halo" aria-hidden="true" />
            <img className="support-brand-image" src="/assets/vros-logo.png" alt="vrOS app icon" />
          </div>
          <div className="support-brand-grid" aria-hidden="true">
            <span className="support-brand-chip">Docs</span>
            <span className="support-brand-chip">Bug intake</span>
            <span className="support-brand-chip">Status</span>
          </div>
        </div>
      </article>

      <div className="home-grid">
        {homeLinks.map((item) => (
          <a className="support-tile vros-card" data-raised="true" key={item.title} href={item.href}>
            <p className="type-micro">Route</p>
            <h3 className="type-h2">{item.title}</h3>
            <p className="type-body">{item.copy}</p>
          </a>
        ))}
      </div>

      <article className="prep-card vros-card">
        <p className="type-micro">Before you file a bug</p>
        <div className="prep-grid">
          <div>
            <h3 className="type-h3">Version + headset</h3>
            <p className="type-small">
              Include your app version, headset, and which overlay or tool failed.
            </p>
          </div>
          <div>
            <h3 className="type-h3">Try the quick fixes</h3>
            <p className="type-small">
              Restart SteamVR, relaunch vrOS, and test with fewer overlays first.
            </p>
          </div>
          <div>
            <h3 className="type-h3">Pick the right lane</h3>
            <p className="type-small">
              Docs for setup, troubleshooting for common issues, bug reports for real failures.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

function TroubleshootingPage() {
  return (
    <div className="troubleshoot-grid">
      {troubleshootCards.map((card) => (
        <article className="vros-card troubleshoot-card" data-raised="true" key={card.title}>
          <h2 className="type-h2">{card.title}</h2>
          <ol className="step-list">
            {card.steps.map((step) => (
              <li className="type-body" key={step}>
                {step}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}

function KnownIssuesPage() {
  return (
    <div className="issue-grid">
      {knownIssues.map((issue) => (
        <article className="vros-card issue-card" data-raised="true" key={issue.title}>
          <div className="issue-head">
            <h2 className="type-h2">{issue.title}</h2>
            <span className="vros-badge" data-tone={issue.tone}>
              Watch item
            </span>
          </div>
          <p className="type-body">{issue.copy}</p>
        </article>
      ))}
    </div>
  );
}

function CommunityPage() {
  return (
    <div className="community-grid">
      <article className="vros-card" data-raised="true">
        <p className="type-micro">Primary help surfaces</p>
        <h2 className="type-h2">Use docs, support, and Steam.</h2>
        <p className="type-body">
          While community channels are being consolidated, the stable public surfaces are docs, support email, and the Steam page.
        </p>
        <div className="hero-card-actions">
          <a className="vros-btn" data-variant="secondary" href="https://docs.vros.cat/">
            <span className="vros-btn-label">Docs center</span>
          </a>
          <a
            className="vros-btn"
            data-variant="secondary"
            href="https://store.steampowered.com/app/3873610"
            target="_blank"
            rel="noreferrer"
          >
            <span className="vros-btn-label">Steam page</span>
          </a>
        </div>
      </article>

      <article className="vros-card">
        <p className="type-micro">What to send us</p>
        <ul className="step-list">
          <li className="type-body">Your vrOS version and headset</li>
          <li className="type-body">Whether the issue happens in desktop control, VR overlays, or both</li>
          <li className="type-body">Which integration or overlay type was active</li>
          <li className="type-body">The smallest set of steps that reproduces it</li>
        </ul>
      </article>

      <article className="vros-card">
        <p className="type-micro">Direct contact</p>
        <h2 className="type-h2">Need private support?</h2>
        <p className="type-body">
          Account-sensitive issues and private logs can go through email.
        </p>
        <a className="vros-btn" data-variant="primary" href="mailto:support@vros.cat">
          <span className="vros-btn-label">Email support@vros.cat</span>
        </a>
      </article>
    </div>
  );
}

function StatusPage() {
  return (
    <div className="status-grid">
      {statusCards.map((card) => (
        <article className="vros-card status-card" data-raised="true" key={card.title}>
          <p className="type-micro">{card.title}</p>
          <h2 className="type-h2">{card.value}</h2>
          <p className="type-body">{card.copy}</p>
        </article>
      ))}

      <article className="vros-card status-note">
        <p className="type-micro">Incident handling</p>
        <p className="type-body">
          A live incident feed is not public yet. We post service changes here and through linked release channels.
        </p>
      </article>
    </div>
  );
}

function ReportBugPage() {
  const systemInfo = useMemo(() => detectSystemInfo(), []);
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "medium",
    category: "general",
    steps: "",
    expected: "",
    actual: "",
    additional: "",
    email: "",
    headset: "",
  });
  const [submitState, setSubmitState] = useState({ state: "idle", message: "" });

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.title.trim().length < 5 || form.description.trim().length < 10) {
      setSubmitState({
        state: "error",
        message: "Please provide a short title and a clear description before submitting.",
      });
      return;
    }

    setSubmitState({ state: "loading", message: "Submitting your report..." });

    try {
      const response = await fetch("https://api.vros.cat/api/submit-bug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Token": getAppToken(),
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          severity: form.severity,
          category: form.category,
          steps: form.steps.trim(),
          expected: form.expected.trim(),
          actual: form.actual.trim(),
          additional: form.additional.trim(),
          systemInfo: {
            ...systemInfo,
            headset: form.headset.trim() || systemInfo.headset,
          },
          contact: {
            email: form.email.trim(),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Bug submission failed.");
      }

      setSubmitState({
        state: "success",
        message: `Report submitted successfully as issue #${payload.issueNumber}.`,
        issueUrl: payload.issueUrl,
      });
      setForm((current) => ({
        ...current,
        title: "",
        description: "",
        steps: "",
        expected: "",
        actual: "",
        additional: "",
      }));
    } catch (error) {
      setSubmitState({
        state: "error",
        message: `${error.message} If the problem continues, email support@vros.cat.`,
      });
    }
  }

  return (
    <div className="report-layout">
      <form className="vros-card bug-form" data-raised="true" onSubmit={handleSubmit}>
        {systemInfo.fromApp ? (
          <span className="vros-badge" data-tone="success">
            Opened from the vrOS app
          </span>
        ) : null}

        <div className="field-grid">
          <label className="field-block">
            <span className="type-label">Title</span>
            <input
              className="vros-input"
              name="title"
              value={form.title}
              onChange={updateField}
              placeholder="Short summary of the bug"
              required
            />
          </label>
          <label className="field-block">
            <span className="type-label">Severity</span>
            <select className="vros-select" name="severity" value={form.severity} onChange={updateField}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="field-block">
            <span className="type-label">Category</span>
            <select className="vros-select" name="category" value={form.category} onChange={updateField}>
              <option value="general">General</option>
              <option value="overlay">Overlay</option>
              <option value="performance">Performance</option>
              <option value="ui">UI / UX</option>
              <option value="audio">Audio</option>
              <option value="input">Input</option>
              <option value="vr">VR runtime</option>
            </select>
          </label>
          <label className="field-block field-wide">
            <span className="type-label">Description</span>
            <textarea
              className="vros-input bug-textarea"
              name="description"
              value={form.description}
              onChange={updateField}
              placeholder="What happened? What were you doing right before it failed?"
              required
            />
          </label>
          <label className="field-block field-wide">
            <span className="type-label">Steps to reproduce</span>
            <textarea
              className="vros-input bug-textarea"
              name="steps"
              value={form.steps}
              onChange={updateField}
              placeholder="List the shortest steps that reproduce the issue."
            />
          </label>
          <label className="field-block">
            <span className="type-label">Expected behavior</span>
            <textarea
              className="vros-input bug-textarea bug-textarea-sm"
              name="expected"
              value={form.expected}
              onChange={updateField}
              placeholder="What should have happened?"
            />
          </label>
          <label className="field-block">
            <span className="type-label">Actual behavior</span>
            <textarea
              className="vros-input bug-textarea bug-textarea-sm"
              name="actual"
              value={form.actual}
              onChange={updateField}
              placeholder="What happened instead?"
            />
          </label>
          <label className="field-block">
            <span className="type-label">Email (optional)</span>
            <input
              className="vros-input"
              type="email"
              name="email"
              value={form.email}
              onChange={updateField}
              placeholder="you@example.com"
            />
          </label>
          <label className="field-block">
            <span className="type-label">Headset (optional)</span>
            <input
              className="vros-input"
              name="headset"
              value={form.headset}
              onChange={updateField}
              placeholder="Valve Index, Quest 3, Vive Pro..."
            />
          </label>
          <label className="field-block field-wide">
            <span className="type-label">Additional notes</span>
            <textarea
              className="vros-input bug-textarea bug-textarea-sm"
              name="additional"
              value={form.additional}
              onChange={updateField}
              placeholder="Logs, observations, or anything else that might help."
            />
          </label>
        </div>

        <div className="form-actions">
          <button className="vros-btn" data-variant="primary" type="submit" disabled={submitState.state === "loading"}>
            <span className="vros-btn-label">
              {submitState.state === "loading" ? "Submitting..." : "Submit report"}
            </span>
          </button>
          <a className="vros-btn" data-variant="ghost" href="mailto:support@vros.cat">
            <span className="vros-btn-label">Email instead</span>
          </a>
        </div>

        {submitState.state !== "idle" ? (
          <div className={`submission-state is-${submitState.state}`}>
            <p className="type-body">{submitState.message}</p>
            {submitState.issueUrl ? (
              <a className="vros-btn" data-variant="link" href={submitState.issueUrl} target="_blank" rel="noreferrer">
                <span className="vros-btn-label">Open created issue</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </form>

      <aside className="sidebar-stack">
        <article className="vros-card">
          <p className="type-micro">Detected system info</p>
          <div className="system-row">
            <span className="type-label">OS</span>
            <span className="type-body">{systemInfo.os}</span>
          </div>
          <div className="system-row">
            <span className="type-label">Browser</span>
            <span className="type-body">{systemInfo.browser}</span>
          </div>
          <div className="system-row">
            <span className="type-label">Version</span>
            <span className="type-body">{systemInfo.version}</span>
          </div>
          <div className="system-row">
            <span className="type-label">Resolution</span>
            <span className="type-body">{systemInfo.resolution}</span>
          </div>
        </article>

        <article className="vros-card">
          <p className="type-micro">Best reports include</p>
          <ul className="step-list">
            <li className="type-body">A reproducible sequence, not just a symptom</li>
            <li className="type-body">Which overlay or integration was active</li>
            <li className="type-body">What changed between working and broken states</li>
            <li className="type-body">Whether the issue happens every time or intermittently</li>
          </ul>
        </article>
      </aside>
    </div>
  );
}

function CurrentPage({ currentPath }) {
  switch (currentPath) {
    case "/troubleshooting":
      return <TroubleshootingPage />;
    case "/known-issues":
      return <KnownIssuesPage />;
    case "/report-bug":
      return <ReportBugPage />;
    case "/community":
      return <CommunityPage />;
    case "/status":
      return <StatusPage />;
    default:
      return <HomePage />;
  }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(normalizePath(window.location.pathname));
  const meta = routeMeta[currentPath] || routeMeta["/"];

  useEffect(() => {
    const onPopState = () => setCurrentPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title =
      currentPath === "/"
        ? "vrOS Support Center"
        : `vrOS Support | ${routeMeta[currentPath]?.title || "Support Center"}`;
  }, [currentPath]);

  return (
    <div className="support-shell">
      <div className="support-backdrop" aria-hidden="true" />
      <header className="support-topbar">
        <a className="brand-link" href="/">
          <img className="brand-mark" src="/assets/vros-logo.png" alt="" />
          <div>
            <p className="type-micro brand-kicker">vrOS / support</p>
            <strong className="brand-name">Support center</strong>
          </div>
        </a>
        <div className="topbar-actions">
          <a className="vros-btn" data-variant="secondary" href="https://docs.vros.cat/">
            <span className="vros-btn-label">Docs</span>
          </a>
          <a className="vros-btn" data-variant="ghost" href="mailto:support@vros.cat">
            <span className="vros-btn-label">Email support</span>
          </a>
        </div>
      </header>

      <main className="support-layout">
        <aside className="support-sidebar vros-card" data-raised="true">
          <nav className="sidebar-nav" aria-label="Support routes">
            {navItems.map((item) => (
              <NavLink currentPath={currentPath} href={item.href} key={item.href} label={item.label} />
            ))}
          </nav>

          <div className="sidebar-callout">
            <p className="type-micro">Quick exit</p>
            <p className="type-small">
              If you already know this is a reproducible bug, skip straight to the report form.
            </p>
            <a className="vros-btn" data-variant="primary" href="/report-bug">
              <span className="vros-btn-label">Open bug form</span>
            </a>
          </div>
        </aside>

        <section className="support-content">
          <header className="content-header">
            <p className="type-micro">{meta.eyebrow}</p>
            <h1 className="type-display">{meta.title}</h1>
            <p className="type-body">{meta.copy}</p>
          </header>

          <CurrentPage currentPath={currentPath} />
        </section>
      </main>

      <footer className="support-footer">
        <div>
          <p className="type-micro">vrOS support</p>
          <p className="type-small">Setup help, troubleshooting, and bug intake.</p>
        </div>
        <div className="footer-links">
          <a href="https://vros.cat/">Main site</a>
          <a href="https://docs.vros.cat/">Docs</a>
          <a href="mailto:support@vros.cat">support@vros.cat</a>
        </div>
      </footer>
    </div>
  );
}
