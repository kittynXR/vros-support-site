/**
 * VROS API Worker - Cloudflare Worker for GitHub Integration
 * 
 * This worker provides a secure proxy between the VROS support site
 * and GitHub's API, handling bug submissions, issue tracking, and patch notes.
 */

// Helper: Get allowed origin for CORS
function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || [
    'https://support.vros.cat',
    'https://bugs.vros.cat',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  if (allowedOrigins.includes(origin)) {
    return origin;
  }
  return allowedOrigins[0]; // Default to first allowed origin
}

// Helper: Create CORS headers
function getCorsHeaders(request, env) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// Helper: Validate app token
async function validateAppToken(token, env) {
  if (!token) return false;
  
  // Check if token exists in KV store
  const storedToken = await env.TOKENS.get(token);
  if (storedToken) {
    // Update last used timestamp
    await env.TOKENS.put(token, JSON.stringify({
      ...JSON.parse(storedToken),
      lastUsed: new Date().toISOString()
    }));
    return true;
  }
  
  // Allow temporary tokens for testing (starts with 'vros-')
  if (token.startsWith('vros-')) {
    // Store new token
    await env.TOKENS.put(token, JSON.stringify({
      created: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      type: 'app-generated'
    }));
    return true;
  }
  
  return false;
}

// Helper: Rate limiting
async function checkRateLimit(ip, env) {
  const key = `rate:${ip}`;
  const currentCount = await env.RATE_LIMIT.get(key);
  
  if (currentCount) {
    const count = parseInt(currentCount);
    if (count >= 10) { // 10 requests per hour
      return false;
    }
    await env.RATE_LIMIT.put(key, (count + 1).toString(), { expirationTtl: 3600 });
  } else {
    await env.RATE_LIMIT.put(key, '1', { expirationTtl: 3600 });
  }
  
  return true;
}

// Handler: GET /api/issues
async function handleGetIssues(request, env, corsHeaders) {
  const url = new URL(request.url);
  const params = url.searchParams;
  
  // Build GitHub API URL
  const githubUrl = new URL(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`);
  
  // Forward query parameters
  ['state', 'labels', 'sort', 'direction', 'since', 'page', 'per_page'].forEach(param => {
    if (params.has(param)) {
      githubUrl.searchParams.set(param, params.get(param));
    }
  });
  
  // Check cache first
  const cacheKey = `issues:${githubUrl.toString()}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }
  
  // Fetch from GitHub
  const response = await fetch(githubUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'VROS-API-Worker'
    }
  });
  
  if (!response.ok) {
    return new Response(JSON.stringify({ error: 'GitHub API error', status: response.status }), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const data = await response.text();
  
  // Cache for 5 minutes
  await env.CACHE.put(cacheKey, data, { expirationTtl: 300 });
  
  return new Response(data, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
}

// Handler: POST /api/submit-bug
async function handleBugSubmit(request, env, corsHeaders) {
  // Get client IP for rate limiting
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  // Check rate limit
  if (!await checkRateLimit(ip, env)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Validate app token
  const appToken = request.headers.get('X-App-Token');
  const isFromApp = await validateAppToken(appToken, env);
  
  // Parse request body
  const body = await request.json();
  
  // Validate required fields
  if (!body.title || !body.description) {
    return new Response(JSON.stringify({ error: 'Missing required fields: title, description' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // Build issue body
  const issueBody = `## Description
${body.description}

## Severity
${body.severity || 'medium'}

## Category
${body.category || 'general'}

${body.steps ? `## Steps to Reproduce\n${body.steps}\n` : ''}
${body.expected ? `## Expected Behavior\n${body.expected}\n` : ''}
${body.actual ? `## Actual Behavior\n${body.actual}\n` : ''}

## System Information
- **Submitted from:** ${isFromApp ? 'VROS App' : 'Web'}
- **OS:** ${body.systemInfo?.os || 'Unknown'}
- **Browser:** ${body.systemInfo?.browser || 'Unknown'}
- **App Version:** ${body.systemInfo?.version || 'N/A'}
- **VR Headset:** ${body.systemInfo?.headset || 'None'}

${body.additional ? `## Additional Information\n${body.additional}` : ''}

---
*Submitted via VROS Bug Tracker${isFromApp ? ' (App)' : ' (Web)'}*`;
  
  // Determine labels
  const labels = ['bug'];
  if (body.severity) labels.push(`severity:${body.severity}`);
  if (body.category) labels.push(`category:${body.category}`);
  if (!isFromApp) labels.push('web-submission');
  
  // Create GitHub issue
  const githubResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'VROS-API-Worker'
      },
      body: JSON.stringify({
        title: body.title,
        body: issueBody,
        labels: labels
      })
    }
  );
  
  if (!githubResponse.ok) {
    const error = await githubResponse.text();
    return new Response(JSON.stringify({ 
      error: 'Failed to create issue', 
      details: error 
    }), {
      status: githubResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const issue = await githubResponse.json();
  
  // Return success with issue details
  return new Response(JSON.stringify({
    success: true,
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    message: 'Bug report submitted successfully'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handler: PUT /api/issues/:number/labels
async function handleUpdateLabels(request, env, corsHeaders, issueNumber) {
  const body = await request.json();
  
  if (!body.labels || !Array.isArray(body.labels)) {
    return new Response(JSON.stringify({ error: 'Labels array required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const githubResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues/${issueNumber}/labels`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'VROS-API-Worker'
      },
      body: JSON.stringify({ labels: body.labels })
    }
  );
  
  if (!githubResponse.ok) {
    return new Response(JSON.stringify({ error: 'Failed to update labels' }), {
      status: githubResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const data = await githubResponse.json();
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handler: GET /api/patch-notes
async function handlePatchNotes(request, env, corsHeaders) {
  // Check cache first
  const cached = await env.CACHE.get('patch-notes');
  if (cached) {
    return new Response(cached, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }
  
  // For now, return static patch notes
  // In production, this would fetch from GitHub releases or a CDN
  const patchNotes = {
    versions: [
      {
        version: "0.1.0",
        date: "2025-01-13",
        title: "Initial Release",
        type: "major",
        sections: {
          features: [
            "Virtual Reality Overlay System foundation",
            "Desktop control panel with system tray",
            "VR Dashboard with process management",
            "Bug tracking and support system",
            "Dark theme optimized for OLED displays"
          ],
          improvements: [],
          fixes: []
        }
      }
    ],
    latest: "0.1.0"
  };
  
  // Cache for 1 hour
  await env.CACHE.put('patch-notes', JSON.stringify(patchNotes), {
    expirationTtl: 3600
  });
  
  return new Response(JSON.stringify(patchNotes), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
}

// Handler: GET /api/latest-version
async function handleLatestVersion(request, env, corsHeaders) {
  // Check cache first
  const cached = await env.CACHE.get('latest-version');
  if (cached) {
    return new Response(cached, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }
  
  // Return latest version info
  const versionInfo = {
    version: "0.1.0",
    date: "2025-01-13",
    updateAvailable: false,
    downloadUrl: "https://github.com/catnet/vros/releases/latest",
    minimumVersion: "0.1.0",
    criticalUpdate: false,
    announcement: null
  };
  
  // Cache for 30 minutes
  await env.CACHE.put('latest-version', JSON.stringify(versionInfo), {
    expirationTtl: 1800
  });
  
  return new Response(JSON.stringify(versionInfo), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
}

// Handler: GET /api/stats
async function handleStats(request, env, corsHeaders) {
  // Check cache
  const cached = await env.CACHE.get('stats');
  if (cached) {
    return new Response(cached, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }
  
  // Fetch repository stats
  const [repoResponse, openIssuesResponse, closedIssuesResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'VROS-API-Worker'
      }
    }),
    fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues?state=open&per_page=1`, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'VROS-API-Worker'
      }
    }),
    fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues?state=closed&per_page=100`, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'VROS-API-Worker'
      }
    })
  ]);
  
  const repo = await repoResponse.json();
  const closedIssues = await closedIssuesResponse.json();
  
  // Parse link header to get total open issues count
  const linkHeader = openIssuesResponse.headers.get('Link');
  let openCount = 0;
  if (linkHeader) {
    const match = linkHeader.match(/page=(\d+)>; rel="last"/);
    if (match) {
      openCount = parseInt(match[1]);
    }
  }
  
  const stats = {
    openIssues: openCount || repo.open_issues_count,
    closedIssues: closedIssues.length,
    stars: repo.stargazers_count,
    watchers: repo.watchers_count,
    forks: repo.forks_count,
    avgResolutionTime: calculateAvgResolutionTime(closedIssues)
  };
  
  const data = JSON.stringify(stats);
  
  // Cache for 30 minutes
  await env.CACHE.put('stats', data, { expirationTtl: 1800 });
  
  return new Response(data, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
}

// Helper: Calculate average resolution time
function calculateAvgResolutionTime(closedIssues) {
  if (closedIssues.length === 0) return 'N/A';
  
  const resolutionTimes = closedIssues
    .filter(issue => issue.created_at && issue.closed_at)
    .map(issue => {
      const created = new Date(issue.created_at);
      const closed = new Date(issue.closed_at);
      return closed - created;
    });
  
  if (resolutionTimes.length === 0) return 'N/A';
  
  const avgMs = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
  const avgDays = Math.round(avgMs / (1000 * 60 * 60 * 24));
  
  return `${avgDays} day${avgDays !== 1 ? 's' : ''}`;
}

// Main request handler
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request, env);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders 
      });
    }
    
    const url = new URL(request.url);
    
    try {
      // Route requests
      if (url.pathname === '/api/issues' && request.method === 'GET') {
        return handleGetIssues(request, env, corsHeaders);
      }
      
      if (url.pathname === '/api/submit-bug' && request.method === 'POST') {
        return handleBugSubmit(request, env, corsHeaders);
      }
      
      if (url.pathname.match(/^\/api\/issues\/(\d+)\/labels$/) && request.method === 'PUT') {
        const match = url.pathname.match(/^\/api\/issues\/(\d+)\/labels$/);
        return handleUpdateLabels(request, env, corsHeaders, match[1]);
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
      
      // Health check
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString() 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};