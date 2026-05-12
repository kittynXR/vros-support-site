/**
 * VROS API Worker - Cloudflare Worker for GitHub Integration
 *
 * Provides a proxy between the support site and GitHub. Mutating endpoints
 * require ADMIN_KEY (set via `wrangler secret put ADMIN_KEY`). The bug-submit
 * endpoint is open but rate-limited and length-capped.
 */

// Length caps for bug submissions
const LIMITS = {
  title: 200,
  description: 5000,
  steps: 2000,
  expected: 2000,
  actual: 2000,
  additional: 2000,
  email: 254,
  headset: 100,
  severity: ['low', 'medium', 'high', 'critical'],
  category: ['general', 'overlay', 'performance', 'ui', 'audio', 'input', 'vr'],
};

// Helper: Resolve the request's allowed origin, or null if disallowed.
function resolveOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || [
    'https://support.vros.cat',
    'https://bugs.vros.cat',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  return allowedOrigins.includes(origin) ? origin : null;
}

// Helper: CORS headers. Omit Allow-Origin entirely when origin is disallowed.
function getCorsHeaders(request, env) {
  const allowed = resolveOrigin(request, env);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token, X-Admin-Key, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = allowed;
  }
  return headers;
}

// Helper: Classify the X-App-Token claim. Unverified — used only for labeling.
function classifySubmissionSource(token) {
  if (typeof token === 'string' && token.startsWith('vros-app-')) {
    return 'app';
  }
  return 'web';
}

// Helper: Require admin key for mutating operations.
function requireAdminKey(request, env) {
  const provided = request.headers.get('X-Admin-Key');
  const expected = env.ADMIN_KEY;
  if (!expected) {
    // Server misconfiguration: no admin key set. Deny by default.
    return false;
  }
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    return false;
  }
  // Constant-time-ish compare
  let mismatch = 0;
  for (let i = 0; i < provided.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

// Helper: Per-IP rate limit. Returns true if allowed.
async function checkRateLimit(ip, env, scope, limit) {
  const key = `rate:${scope}:${ip}`;
  const current = await env.RATE_LIMIT.get(key);
  if (current) {
    const count = parseInt(current, 10);
    if (count >= limit) {
      return false;
    }
    await env.RATE_LIMIT.put(key, (count + 1).toString(), { expirationTtl: 3600 });
  } else {
    await env.RATE_LIMIT.put(key, '1', { expirationTtl: 3600 });
  }
  return true;
}

// Helper: Validate bug submission body. Returns {ok, errors, normalized}.
function validateBugBody(body) {
  const errors = [];

  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (title.length < 5) errors.push('Title must be at least 5 characters.');
  if (title.length > LIMITS.title) errors.push(`Title must be at most ${LIMITS.title} characters.`);
  if (description.length < 10) errors.push('Description must be at least 10 characters.');
  if (description.length > LIMITS.description) {
    errors.push(`Description must be at most ${LIMITS.description} characters.`);
  }

  const optionalText = ['steps', 'expected', 'actual', 'additional'];
  const normalized = { title, description };

  for (const field of optionalText) {
    const raw = typeof body[field] === 'string' ? body[field].trim() : '';
    if (raw.length > LIMITS[field]) {
      errors.push(`${field} must be at most ${LIMITS[field]} characters.`);
    }
    normalized[field] = raw;
  }

  const severity = typeof body.severity === 'string' ? body.severity : 'medium';
  if (!LIMITS.severity.includes(severity)) {
    errors.push(`severity must be one of: ${LIMITS.severity.join(', ')}.`);
  }
  normalized.severity = severity;

  const category = typeof body.category === 'string' ? body.category : 'general';
  if (!LIMITS.category.includes(category)) {
    errors.push(`category must be one of: ${LIMITS.category.join(', ')}.`);
  }
  normalized.category = category;

  const contactEmail =
    typeof body.contact?.email === 'string' ? body.contact.email.trim() : '';
  if (contactEmail.length > LIMITS.email) {
    errors.push(`email must be at most ${LIMITS.email} characters.`);
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.push('email must be a valid address.');
  }
  normalized.contactEmail = contactEmail;

  const sysInfo = body.systemInfo && typeof body.systemInfo === 'object' ? body.systemInfo : {};
  const safeSys = {};
  for (const key of ['os', 'browser', 'version', 'headset', 'resolution']) {
    const value = typeof sysInfo[key] === 'string' ? sysInfo[key].trim() : '';
    if (value.length > LIMITS.headset && key === 'headset') {
      errors.push(`headset must be at most ${LIMITS.headset} characters.`);
    }
    if (value.length > 200) {
      safeSys[key] = `${value.slice(0, 200)}…`;
    } else {
      safeSys[key] = value;
    }
  }
  normalized.systemInfo = safeSys;

  return { ok: errors.length === 0, errors, normalized };
}

// Handler: GET /api/issues
async function handleGetIssues(request, env, corsHeaders) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const githubUrl = new URL(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`,
  );

  ['state', 'labels', 'sort', 'direction', 'since', 'page', 'per_page'].forEach((param) => {
    if (params.has(param)) {
      githubUrl.searchParams.set(param, params.get(param));
    }
  });

  const cacheKey = `issues:${githubUrl.toString()}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  const response = await fetch(githubUrl.toString(), {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'VROS-API-Worker',
    },
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: 'GitHub API error', status: response.status }),
      {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const data = await response.text();
  await env.CACHE.put(cacheKey, data, { expirationTtl: 300 });

  return new Response(data, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}

// Handler: POST /api/submit-bug
async function handleBugSubmit(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (!(await checkRateLimit(ip, env, 'submit-bug', 3))) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour, or ask in our Discord.' }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  // Reject oversized bodies before parsing.
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > 32 * 1024) {
    return new Response(JSON.stringify({ error: 'Request body too large.' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { ok, errors, normalized } = validateBugBody(body);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Validation failed.', details: errors }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const source = classifySubmissionSource(request.headers.get('X-App-Token'));

  const issueBody = `## Description
${normalized.description}

## Severity
${normalized.severity}

## Category
${normalized.category}

${normalized.steps ? `## Steps to Reproduce\n${normalized.steps}\n` : ''}
${normalized.expected ? `## Expected Behavior\n${normalized.expected}\n` : ''}
${normalized.actual ? `## Actual Behavior\n${normalized.actual}\n` : ''}

## System Information (unverified, client-reported)
- **Submission source:** ${source} (claimed)
- **OS:** ${normalized.systemInfo.os || 'Unknown'}
- **Browser:** ${normalized.systemInfo.browser || 'Unknown'}
- **App Version:** ${normalized.systemInfo.version || 'N/A'}
- **VR Headset:** ${normalized.systemInfo.headset || 'None'}

${normalized.additional ? `## Additional Information\n${normalized.additional}` : ''}

---
*Submitted via VROS Bug Tracker (${source})*`;

  const labels = ['bug', `severity:${normalized.severity}`, `category:${normalized.category}`];
  labels.push(source === 'app' ? 'source:app-claimed' : 'source:web');

  const githubResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'VROS-API-Worker',
      },
      body: JSON.stringify({
        title: normalized.title,
        body: issueBody,
        labels,
      }),
    },
  );

  if (!githubResponse.ok) {
    console.error('GitHub issue create failed:', githubResponse.status);
    return new Response(JSON.stringify({ error: 'Failed to create issue.' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const issue = await githubResponse.json();

  return new Response(
    JSON.stringify({
      success: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      message: 'Bug report submitted successfully',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

// Handler: PUT /api/issues/:number/labels  (admin)
async function handleUpdateLabels(request, env, corsHeaders, issueNumber) {
  if (!requireAdminKey(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await checkRateLimit(ip, env, 'admin', 60))) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(body.labels) || body.labels.some((l) => typeof l !== 'string')) {
    return new Response(JSON.stringify({ error: 'labels must be an array of strings.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (body.labels.length > 30) {
    return new Response(JSON.stringify({ error: 'Too many labels.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const githubResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues/${issueNumber}/labels`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'VROS-API-Worker',
      },
      body: JSON.stringify({ labels: body.labels }),
    },
  );

  if (!githubResponse.ok) {
    console.error('Update labels failed:', githubResponse.status);
    return new Response(JSON.stringify({ error: 'Failed to update labels.' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await invalidateIssueCache(env);

  const data = await githubResponse.json();
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Handler: PUT /api/issues/:number/status  (admin)
async function handleUpdateStatus(request, env, corsHeaders, issueNumber) {
  if (!requireAdminKey(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await checkRateLimit(ip, env, 'admin', 60))) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const allowedStatuses = ['triage', 'in-progress', 'blocked', 'review', 'done'];
  if (typeof body.status !== 'string' || !allowedStatuses.includes(body.status)) {
    return new Response(
      JSON.stringify({ error: `status must be one of: ${allowedStatuses.join(', ')}.` }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const issueResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues/${issueNumber}`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'VROS-API-Worker',
      },
    },
  );

  if (!issueResponse.ok) {
    return new Response(JSON.stringify({ error: 'Issue not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const issue = await issueResponse.json();

  const existingLabels = issue.labels
    .map((label) => label.name)
    .filter((name) => !name.startsWith('status:'));

  const newLabels = [...existingLabels, `status:${body.status}`];

  await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues/${issueNumber}/labels`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'VROS-API-Worker',
      },
      body: JSON.stringify({ labels: newLabels }),
    },
  );

  if (body.status === 'done' && issue.state === 'open') {
    await fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'VROS-API-Worker',
        },
        body: JSON.stringify({ state: 'closed' }),
      },
    );
  } else if (body.status !== 'done' && issue.state === 'closed') {
    await fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'VROS-API-Worker',
        },
        body: JSON.stringify({ state: 'open' }),
      },
    );
  }

  await invalidateIssueCache(env);

  return new Response(JSON.stringify({ success: true, status: body.status }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function invalidateIssueCache(env) {
  const cacheKeys = await env.CACHE.list();
  for (const key of cacheKeys.keys) {
    if (key.name.startsWith('issues:')) {
      await env.CACHE.delete(key.name);
    }
  }
}

// Handler: GET /api/patch-notes
async function handlePatchNotes(request, env, corsHeaders) {
  const cached = await env.CACHE.get('patch-notes');
  if (cached) {
    return new Response(cached, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  const patchNotes = {
    versions: [
      {
        version: '0.1.0',
        date: '2025-01-13',
        title: 'Initial Release',
        type: 'major',
        sections: {
          features: [
            'Virtual Reality Overlay System foundation',
            'Desktop control panel with system tray',
            'VR Dashboard with process management',
            'Bug tracking and support system',
            'Dark theme optimized for OLED displays',
          ],
          improvements: [],
          fixes: [],
        },
      },
    ],
    latest: '0.1.0',
  };

  await env.CACHE.put('patch-notes', JSON.stringify(patchNotes), { expirationTtl: 3600 });

  return new Response(JSON.stringify(patchNotes), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}

// Handler: GET /api/latest-version
async function handleLatestVersion(request, env, corsHeaders) {
  const cached = await env.CACHE.get('latest-version');
  if (cached) {
    return new Response(cached, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  const versionInfo = {
    version: '0.1.0',
    date: '2025-01-13',
    updateAvailable: false,
    downloadUrl: 'https://github.com/catnet/vros/releases/latest',
    minimumVersion: '0.1.0',
    criticalUpdate: false,
    announcement: null,
  };

  await env.CACHE.put('latest-version', JSON.stringify(versionInfo), { expirationTtl: 1800 });

  return new Response(JSON.stringify(versionInfo), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}

// Handler: GET /api/stats
async function handleStats(request, env, corsHeaders) {
  const cached = await env.CACHE.get('stats');
  if (cached) {
    return new Response(cached, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  const [repoResponse, openIssuesResponse, closedIssuesResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'VROS-API-Worker',
      },
    }),
    fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues?state=open&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'VROS-API-Worker',
        },
      },
    ),
    fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues?state=closed&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'VROS-API-Worker',
        },
      },
    ),
  ]);

  const repo = await repoResponse.json();
  const closedIssues = await closedIssuesResponse.json();

  const linkHeader = openIssuesResponse.headers.get('Link');
  let openCount = 0;
  if (linkHeader) {
    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
    if (match) {
      openCount = parseInt(match[1], 10);
    }
  }

  const stats = {
    openIssues: openCount || repo.open_issues_count,
    closedIssues: closedIssues.length,
    stars: repo.stargazers_count,
    watchers: repo.watchers_count,
    forks: repo.forks_count,
    avgResolutionTime: calculateAvgResolutionTime(closedIssues),
  };

  const data = JSON.stringify(stats);
  await env.CACHE.put('stats', data, { expirationTtl: 1800 });

  return new Response(data, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}

function calculateAvgResolutionTime(closedIssues) {
  if (closedIssues.length === 0) return 'N/A';

  const resolutionTimes = closedIssues
    .filter((issue) => issue.created_at && issue.closed_at)
    .map((issue) => new Date(issue.closed_at) - new Date(issue.created_at));

  if (resolutionTimes.length === 0) return 'N/A';

  const avgMs = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
  const avgDays = Math.round(avgMs / (1000 * 60 * 60 * 24));

  return `${avgDays} day${avgDays !== 1 ? 's' : ''}`;
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/issues' && request.method === 'GET') {
        return handleGetIssues(request, env, corsHeaders);
      }

      if (url.pathname === '/api/submit-bug' && request.method === 'POST') {
        return handleBugSubmit(request, env, corsHeaders);
      }

      const labelsMatch = url.pathname.match(/^\/api\/issues\/(\d+)\/labels$/);
      if (labelsMatch && request.method === 'PUT') {
        return handleUpdateLabels(request, env, corsHeaders, labelsMatch[1]);
      }

      const statusMatch = url.pathname.match(/^\/api\/issues\/(\d+)\/status$/);
      if (statusMatch && request.method === 'PUT') {
        return handleUpdateStatus(request, env, corsHeaders, statusMatch[1]);
      }

      if (url.pathname === '/api/patch-notes' && request.method === 'GET') {
        return handlePatchNotes(request, env, corsHeaders);
      }

      if (url.pathname === '/api/latest-version' && request.method === 'GET') {
        return handleLatestVersion(request, env, corsHeaders);
      }

      if (url.pathname === '/api/stats' && request.method === 'GET') {
        return handleStats(request, env, corsHeaders);
      }

      if (url.pathname === '/api/health') {
        return new Response(
          JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Worker error:', error?.stack || error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
