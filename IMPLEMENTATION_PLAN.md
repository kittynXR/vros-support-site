# VROS Bug Tracking & Support System - Implementation Plan

## 📋 Current Status

### ✅ Completed
1. **Support Site Structure** - Dark-themed HTML/CSS created
2. **React App Foundation** - Vite setup with dependencies installed

### 🚧 Remaining Tasks

## Phase 1: Complete the Bug Tracker UI (Days 1-2)

### Task 3: Complete Kanban Board Component
**Files to create/modify:**
- `bugs-tracker/src/components/KanbanBoard.jsx`
- `bugs-tracker/src/components/KanbanColumn.jsx`
- `bugs-tracker/src/components/IssueCard.jsx`
- `bugs-tracker/src/styles/kanban.css`

**Implementation:**
```jsx
// Key features to implement:
- 5 columns: Backlog, To Do, In Progress, Testing, Done
- Drag-and-drop between columns using @hello-pangea/dnd
- Auto-update GitHub labels on drop
- Real-time sync with GitHub Issues
- Filter by: severity, category, assignee
- Search functionality
```

### Task 4: GitHub API Integration Layer
**Files to create:**
- `bugs-tracker/src/api/github.js`
- `bugs-tracker/src/api/config.js`
- `bugs-tracker/src/utils/labelMapper.js`

**Key Functions:**
```javascript
- fetchIssues(filters)
- createIssue(data)
- updateIssueLabels(issueId, labels)
- assignIssue(issueId, username)
- closeIssue(issueId)
- addComment(issueId, comment)
```

### Task 5: Issue Cards & Column Components
**Features:**
- Display issue #, title, description preview
- Show labels with colors
- Assignee avatar
- Created date
- Priority indicator
- Click to expand full details
- Quick actions (assign, label, close)

### Task 6: Bug Submission Form JavaScript
**File:** `vros_site/support/js/bug-form.js`
**Features:**
- Form validation
- System info auto-detection
- Submit to Cloudflare Worker
- Success/error handling
- Redirect to created issue

## Phase 2: Backend Infrastructure (Days 3-4)

### Task 7-8: Cloudflare Worker Setup

**See detailed documentation below**

## Phase 3: App Integration (Days 5-6)

### Task 9: Update desktop-core About Dialog
**Files to modify:**
- `crates/desktop-core/src/app.rs`
- `crates/desktop-core/src/about.rs` (new file)

**Features:**
- Add "What's New" tab with patch notes
- Add "Report Bug" button
- System info collection
- Link to support site with token

### Task 10: Update vros-dashboard About Dialog
**Files to modify:**
- `crates/vros-dashboard/src/lib.rs`
- `crates/vros-dashboard/src/widgets/about_dialog.rs` (new file)

**Features:**
- Add About button to header (clickable logo)
- Mirror desktop-core About dialog
- Shared components where possible

## Phase 4: Patch Notes System (Day 7)

### Task 11-12: Patch Notes Implementation
**Files to create:**
- `vros_site/patch-notes.json`
- `vros_site/api/patch-notes-worker.js`

**Structure:**
```json
{
  "releases": [
    {
      "version": "1.2.0",
      "date": "2025-01-15",
      "highlights": ["Major feature"],
      "changes": {
        "features": [],
        "improvements": [],
        "bugfixes": []
      }
    }
  ]
}
```

## Phase 5: Deployment (Day 8)

### Task 13-14: GitHub Pages & Actions
**Files to create:**
- `.github/workflows/deploy-support.yml`
- `.github/workflows/deploy-tracker.yml`
- `vros_site/support/CNAME`
- `vros_site/bugs-tracker/CNAME`

### Task 15: Testing
- End-to-end bug submission
- Kanban board drag-and-drop
- GitHub sync verification
- Mobile responsiveness
- Cross-browser testing

---

# Cloudflare Worker Setup Documentation

## 🚀 Complete Setup Guide for Cloudflare Workers

### Prerequisites
- Cloudflare account (free tier is fine)
- GitHub Personal Access Token with `repo` scope
- Node.js installed locally
- Wrangler CLI (`npm install -g wrangler`)

### Step 1: Create Cloudflare Account & Workers
1. Go to https://dash.cloudflare.com
2. Sign up/login
3. Navigate to Workers & Pages
4. Create new Worker: "vros-api"

### Step 2: Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### Step 3: Create Worker Project Structure
```bash
mkdir vros-cloudflare-workers
cd vros-cloudflare-workers
npm init -y
npm install --save-dev wrangler
```

### Step 4: Configure wrangler.toml
Create `wrangler.toml`:
```toml
name = "vros-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Environment variables (set via dashboard or CLI)
[vars]
GITHUB_OWNER = "catnet"
GITHUB_REPO = "vros-bugs"
ALLOWED_ORIGINS = "https://support.vros.cat,https://bugs.vros.cat,http://localhost:5173"

# KV Namespaces for storage
[[kv_namespaces]]
binding = "TOKENS"
id = "YOUR_KV_NAMESPACE_ID"

[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_CACHE_NAMESPACE_ID"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "YOUR_RATE_LIMIT_NAMESPACE_ID"

# Secrets (set via wrangler secret)
# wrangler secret put GITHUB_TOKEN
# wrangler secret put ADMIN_KEY
```

### Step 5: Create the Worker Code
Create `src/index.js`:
```javascript
export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': getAllowedOrigin(request, env),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    try {
      // Route handlers
      switch (url.pathname) {
        case '/api/issues':
          return handleIssues(request, env, corsHeaders);
        case '/api/submit-bug':
          return handleBugSubmit(request, env, corsHeaders);
        case '/api/patch-notes':
          return handlePatchNotes(request, env, corsHeaders);
        case '/api/stats':
          return handleStats(request, env, corsHeaders);
        default:
          return new Response('Not found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleIssues(request, env, corsHeaders) {
  // Implementation here
}

async function handleBugSubmit(request, env, corsHeaders) {
  // Implementation here
}
```

### Step 6: Set Secrets
```bash
# Set your GitHub Personal Access Token
wrangler secret put GITHUB_TOKEN
# Enter your token when prompted

# Set admin key for protected endpoints
wrangler secret put ADMIN_KEY
# Enter a secure random string
```

### Step 7: Create KV Namespaces
```bash
# Create KV namespaces
wrangler kv:namespace create "TOKENS"
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "RATE_LIMIT"

# Note the IDs and update wrangler.toml
```

### Step 8: Deploy the Worker
```bash
# Test locally
wrangler dev

# Deploy to production
wrangler deploy
```

### Step 9: Configure Custom Domain (Optional)
1. In Cloudflare Dashboard → Workers → your worker
2. Go to "Triggers" tab
3. Add custom domain: `api.vros.cat`
4. Add DNS record pointing to worker

### Step 10: Test the API
```bash
# Test bug submission
curl -X POST https://vros-api.YOUR-SUBDOMAIN.workers.dev/api/submit-bug \
  -H "Content-Type: application/json" \
  -H "X-App-Token: test-token" \
  -d '{
    "title": "Test Bug",
    "description": "Testing the API",
    "severity": "low"
  }'

# Test fetching issues
curl https://vros-api.YOUR-SUBDOMAIN.workers.dev/api/issues
```

## 📝 Full Worker Implementation

Create `src/worker.js`:
```javascript
// See full implementation in vros_site/api/worker.js
```

## 🔒 Security Considerations

1. **Rate Limiting**: Implement per-IP rate limiting
2. **Token Validation**: Validate app tokens for bug submissions
3. **CORS**: Strict origin checking
4. **Input Sanitization**: Clean all user inputs
5. **GitHub Token**: Never expose in responses
6. **Caching**: Cache GitHub responses to avoid rate limits

## 🎯 Endpoints

### POST /api/submit-bug
Submit a new bug report
```json
{
  "title": "Bug title",
  "description": "Detailed description",
  "severity": "low|medium|high|critical",
  "category": "general|vr|overlay|performance|ui",
  "systemInfo": {}
}
```

### GET /api/issues
Fetch issues with filters
```
/api/issues?state=open&labels=bug&sort=created
```

### GET /api/patch-notes
Get latest patch notes
```
/api/patch-notes?limit=5
```

### GET /api/stats
Get repository statistics
```
/api/stats
```

## 🚦 Testing Checklist

- [ ] CORS working from support.vros.cat
- [ ] Bug submission creates GitHub issue
- [ ] Rate limiting prevents spam
- [ ] Token validation working
- [ ] Caching reduces GitHub API calls
- [ ] Error handling returns proper status codes
- [ ] Patch notes endpoint returns JSON
- [ ] Stats endpoint aggregates correctly

## 📊 Monitoring

1. **Cloudflare Dashboard**: Monitor requests, errors
2. **GitHub API Rate Limit**: Check remaining quota
3. **KV Storage**: Monitor usage
4. **Worker Logs**: Use `wrangler tail` for real-time logs

## 🔧 Maintenance

### Update Worker Code
```bash
# Edit src/index.js
wrangler deploy
```

### Update Secrets
```bash
wrangler secret put GITHUB_TOKEN
```

### Clear Cache
```bash
wrangler kv:key delete --namespace-id=CACHE_ID "cache-key"
```

## 💰 Cost Considerations

**Free Tier Limits:**
- 100,000 requests/day
- 10ms CPU time per request
- 1MB KV storage

**Our Usage (Estimated):**
- ~1,000 requests/day
- Well within free tier

---

## Next Steps Priority Order

1. **Complete Kanban Board** (Critical for UX)
2. **Set up Cloudflare Worker** (Enable bug submission)
3. **Implement GitHub API layer** (Connect everything)
4. **Update About dialogs** (App integration)
5. **Deploy to production** (Go live)

## Timeline
- **Week 1**: UI Components (Kanban, Forms)
- **Week 2**: Backend (Worker, API)
- **Week 3**: Integration (Apps, Testing)
- **Week 4**: Deployment & Polish