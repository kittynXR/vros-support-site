import { useEffect, useMemo, useState } from "react";

const DISCORD_URL = "https://discord.gg/bfBsmUPaRy";

const routeMeta = {
  "/": {
    eyebrow: "Support",
    title: "Get help on the vrOS Discord.",
    copy: "Discord is the fastest way to reach us. Use the bug form only for reproducible issues that need a tracked ticket.",
  },
  "/report-bug": {
    eyebrow: "Bug intake",
    title: "Send a bug report.",
    copy: "Most issues are answered faster on Discord. File a report here only when you can reproduce the problem.",
  },
};

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  const cleanPath = pathname.replace(/\/+$/, "");
  if (cleanPath === "/report-bug.html" || cleanPath === "/bugs" || cleanPath === "/report-bug") {
    return "/report-bug";
  }
  return "/";
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

function DiscordCta({ variant = "primary", label = "Join the vrOS Discord" }) {
  return (
    <a
      className="vros-btn"
      data-variant={variant}
      href={DISCORD_URL}
      target="_blank"
      rel="noreferrer"
    >
      <span className="vros-btn-label">{label}</span>
    </a>
  );
}

function HomePage() {
  return (
    <div className="content-stack">
      <article className="hero-card vros-card" data-raised="true">
        <div className="hero-card-copy">
          <span className="vros-badge" data-tone="primary">Support</span>
          <h2 className="type-h1">Discord is the fastest way to reach the vrOS team.</h2>
          <p className="type-body">
            Install help, overlay questions, creator tools, general chat — ask in Discord and a real human will reply. Save the bug form for reproducible failures that need a permanent ticket.
          </p>
          <div className="hero-card-actions">
            <DiscordCta />
            <a className="vros-btn" data-variant="secondary" href="/report-bug">
              <span className="vros-btn-label">Report a bug</span>
            </a>
          </div>
        </div>
        <div className="hero-card-image support-brand-panel" aria-label="vrOS support brand panel">
          <div className="support-brand-head">
            <span className="vros-badge" data-tone="primary">Support surface</span>
            <span className="type-mono support-brand-route">support.vros.cat</span>
          </div>
          <div className="support-brand-stage">
            <div className="support-brand-halo" aria-hidden="true" />
            <img className="support-brand-image" src="/assets/vros-logo.png" alt="vrOS app icon" />
          </div>
          <div className="support-brand-grid" aria-hidden="true">
            <span className="support-brand-chip">Discord</span>
            <span className="support-brand-chip">Bug intake</span>
            <span className="support-brand-chip">Docs</span>
          </div>
        </div>
      </article>

      <article className="vros-card" data-raised="true">
        <p className="type-micro">Where to go</p>
        <div className="prep-grid">
          <div>
            <h3 className="type-h3">Discord</h3>
            <p className="type-small">
              Real-time help, install questions, and community chat. <a href={DISCORD_URL} target="_blank" rel="noreferrer">discord.gg/bfBsmUPaRy</a>
            </p>
          </div>
          <div>
            <h3 className="type-h3">Docs</h3>
            <p className="type-small">
              Install, first run, overlays, release notes. <a href="https://docs.vros.cat/">docs.vros.cat</a>
            </p>
          </div>
          <div>
            <h3 className="type-h3">Bug form</h3>
            <p className="type-small">
              Reproducible failures that need a tracked GitHub ticket. <a href="/report-bug">Open form</a>.
            </p>
          </div>
        </div>
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
        message: `${error.message} If the problem continues, ask in the vrOS Discord.`,
      });
    }
  }

  return (
    <div className="report-layout">
      <div className="content-stack">
        <article className="vros-card" data-raised="true">
          <p className="type-micro">Try Discord first</p>
          <h2 className="type-h2">Most issues are answered faster on Discord.</h2>
          <p className="type-body">
            Install help, overlay quirks, and quick troubleshooting are usually solved in minutes by the community. Use this form only for reproducible bugs that need a tracked GitHub ticket.
          </p>
          <div className="hero-card-actions">
            <DiscordCta />
          </div>
        </article>

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
            <DiscordCta variant="ghost" label="Ask on Discord instead" />
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
      </div>

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
  if (currentPath === "/report-bug") return <ReportBugPage />;
  return <HomePage />;
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
    document.title = currentPath === "/report-bug" ? "vrOS Support | Report a Bug" : "vrOS Support";
  }, [currentPath]);

  return (
    <div className="support-shell">
      <div className="support-backdrop" aria-hidden="true" />
      <header className="support-topbar">
        <a className="brand-link" href="/">
          <img className="brand-mark" src="/assets/vros-logo.png" alt="" />
          <div>
            <p className="type-micro brand-kicker">vrOS / support</p>
            <strong className="brand-name">Support</strong>
          </div>
        </a>
        <div className="topbar-actions">
          <DiscordCta />
          <a className="vros-btn" data-variant="secondary" href="/report-bug">
            <span className="vros-btn-label">Report a bug</span>
          </a>
          <a className="vros-btn" data-variant="ghost" href="https://docs.vros.cat/">
            <span className="vros-btn-label">Docs</span>
          </a>
        </div>
      </header>

      <main className="support-layout">
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
          <p className="type-small">Real-time help on Discord. Bug form for reproducible issues.</p>
        </div>
        <div className="footer-links">
          <a href={DISCORD_URL} target="_blank" rel="noreferrer">Discord</a>
          <a href="https://vros.cat/">Main site</a>
          <a href="https://docs.vros.cat/">Docs</a>
          <a href="mailto:support@vros.cat">support@vros.cat</a>
        </div>
      </footer>
    </div>
  );
}
