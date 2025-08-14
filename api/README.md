# VROS API - Cloudflare Worker

This Cloudflare Worker provides a secure API proxy between the VROS support site and GitHub's API, handling bug submissions, issue tracking, and patch notes.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Cloudflare account (free tier works)
- GitHub Personal Access Token with `repo` scope

### Automatic Setup (Recommended)

```bash
# Install dependencies
npm install

# Run setup script
npm run setup
# or on Windows: setup.bat
# or on Linux/Mac: ./setup.sh
```

### Manual Setup

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Create KV Namespaces**
   ```bash
   wrangler kv:namespace create "TOKENS"
   wrangler kv:namespace create "CACHE"
   wrangler kv:namespace create "RATE_LIMIT"
   ```

4. **Update wrangler.toml**
   Replace the namespace IDs with the ones from step 3:
   ```toml
   [[kv_namespaces]]
   binding = "TOKENS"
   id = "your-tokens-namespace-id"
   ```

5. **Set Secrets**
   ```bash
   # GitHub Personal Access Token
   wrangler secret put GITHUB_TOKEN
   # Enter your token when prompted

   # Admin key for protected endpoints
   wrangler secret put ADMIN_KEY
   # Enter a secure random string
   ```

6. **Deploy**
   ```bash
   wrangler deploy
   ```

## 📡 API Endpoints

### Public Endpoints

#### GET /api/health
Health check endpoint
```bash
curl https://your-worker.workers.dev/api/health
```

#### GET /api/issues
Fetch GitHub issues
```bash
curl "https://your-worker.workers.dev/api/issues?state=open&labels=bug"
```

Query parameters:
- `state`: open, closed, all
- `labels`: comma-separated list
- `sort`: created, updated, comments
- `direction`: asc, desc
- `page`: page number
- `per_page`: items per page (max 100)

#### POST /api/submit-bug
Submit a new bug report
```bash
curl -X POST https://your-worker.workers.dev/api/submit-bug \
  -H "Content-Type: application/json" \
  -H "X-App-Token: vros-abc123" \
  -d '{
    "title": "Bug title",
    "description": "Detailed description",
    "severity": "medium",
    "category": "general",
    "systemInfo": {
      "os": "Windows",
      "browser": "Chrome",
      "version": "1.0.0"
    }
  }'
```

#### PUT /api/issues/:number/labels
Update issue labels (requires app token)
```bash
curl -X PUT https://your-worker.workers.dev/api/issues/123/labels \
  -H "Content-Type: application/json" \
  -H "X-App-Token: vros-abc123" \
  -d '{"labels": ["bug", "severity:high"]}'
```

#### GET /api/patch-notes
Get release notes
```bash
curl https://your-worker.workers.dev/api/patch-notes
```

#### GET /api/stats
Get repository statistics
```bash
curl https://your-worker.workers.dev/api/stats
```

## 🔧 Configuration

### Environment Variables (wrangler.toml)

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_OWNER` | GitHub repository owner | catnet |
| `GITHUB_REPO` | GitHub repository name | vros-bugs |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed origins | https://support.vros.cat,https://bugs.vros.cat |

### Secrets (via wrangler secret)

| Secret | Description | Required |
|--------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes |
| `ADMIN_KEY` | Admin key for protected endpoints | Yes |

## 🛠️ Development

### Local Development
```bash
# Start local dev server
npm run dev
# or
wrangler dev

# Worker will be available at http://localhost:8787
```

### View Logs
```bash
# Real-time logs from production
npm run tail
# or
wrangler tail
```

### Deploy Updates
```bash
# Deploy to production
npm run deploy
# or
wrangler deploy

# Deploy to specific environment
npm run deploy:prod
```

## 🔒 Security Features

1. **CORS Protection**: Only allows requests from configured origins
2. **Rate Limiting**: 10 requests per hour per IP
3. **Token Validation**: App tokens required for certain operations
4. **Input Sanitization**: All user inputs are validated
5. **Caching**: Reduces GitHub API calls and improves performance

## 📊 KV Storage Structure

### TOKENS Namespace
Stores app tokens for validation
```json
{
  "vros-abc123": {
    "created": "2025-01-15T10:00:00Z",
    "lastUsed": "2025-01-15T12:00:00Z",
    "type": "app-generated"
  }
}
```

### CACHE Namespace
Caches GitHub API responses
```
Key: "issues:https://api.github.com/repos/..."
Value: [GitHub API response]
TTL: 300 seconds (5 minutes)
```

### RATE_LIMIT Namespace
Tracks request counts per IP
```
Key: "rate:192.168.1.1"
Value: "5"
TTL: 3600 seconds (1 hour)
```

## 🚦 Testing

### Test Health Endpoint
```bash
curl https://your-worker.workers.dev/api/health
```

### Test Bug Submission
```bash
curl -X POST https://your-worker.workers.dev/api/submit-bug \
  -H "Content-Type: application/json" \
  -H "X-App-Token: vros-test" \
  -d '{
    "title": "Test Bug",
    "description": "This is a test bug report"
  }'
```

### Test with Frontend
Update your frontend configuration to use the worker URL:
```javascript
const API_URL = 'https://your-worker.workers.dev/api';
// or for custom domain:
const API_URL = 'https://api.vros.cat';
```

## 🌐 Custom Domain Setup

1. Go to Cloudflare Dashboard → Workers
2. Select your worker
3. Go to "Triggers" tab
4. Add custom domain: `api.vros.cat`
5. Add DNS record in your domain settings

## 📈 Monitoring

- **Cloudflare Dashboard**: View requests, errors, and performance
- **Worker Analytics**: Monitor usage and response times
- **GitHub API Rate Limit**: Check via `/api/health` endpoint

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `ALLOWED_ORIGINS` in wrangler.toml
   - Ensure origin is in the allowed list

2. **Rate Limit Exceeded**
   - Wait 1 hour or contact admin
   - Check IP-based limits

3. **GitHub API Errors**
   - Verify GITHUB_TOKEN is valid
   - Check GitHub API rate limits

4. **KV Namespace Errors**
   - Ensure namespace IDs are correct in wrangler.toml
   - Verify namespaces exist in Cloudflare dashboard

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Support

For issues or questions:
- Create an issue in the GitHub repository
- Contact support at support@vros.cat
- Join our Discord server

---

Built with ❤️ by CatNet Systems for the VROS community