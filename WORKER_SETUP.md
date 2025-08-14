# Cloudflare Worker Setup for Email Collection

This guide will help you deploy the email collection worker for VROS beta signups.

## Prerequisites

1. A Cloudflare account (free tier is fine)
2. A domain on Cloudflare (vros.cat)

## Setup Steps

### 1. Create KV Namespace

1. Go to Cloudflare Dashboard → Workers & Pages → KV
2. Click "Create namespace"
3. Name it: `BETA_SIGNUPS`
4. Click "Add"

### 2. Create the Worker

1. Go to Workers & Pages → Create application → Create Worker
2. Name it: `vros-beta-signup`
3. Click "Deploy"

### 3. Add the Worker Code

1. Click "Edit code"
2. Replace the default code with the contents of `worker.js`
3. Click "Save and Deploy"

### 4. Bind KV Namespace

1. Go to Worker Settings → Variables
2. Under "KV Namespace Bindings":
   - Variable name: `BETA_SIGNUPS`
   - KV namespace: Select the one you created
3. Save

### 5. Configure Custom Domain (Optional)

1. Go to Worker Settings → Triggers
2. Add Custom Domain: `beta-api.vros.cat`
3. Or use the default: `vros-beta-signup.YOUR-SUBDOMAIN.workers.dev`

### 6. Update the Website

1. Edit `js/main.js`
2. Replace `YOUR-SUBDOMAIN` with your actual worker URL:
   ```javascript
   const WORKER_URL = 'https://vros-beta-signup.YOUR-SUBDOMAIN.workers.dev';
   // or
   const WORKER_URL = 'https://beta-api.vros.cat';
   ```

### 7. Test the Setup

1. Visit your website
2. Try submitting an email
3. Check KV namespace for stored data

## Viewing Collected Emails

### Via Dashboard
1. Go to Workers & Pages → KV → BETA_SIGNUPS
2. Click "View" to see all stored data

### Via Wrangler CLI
```bash
# Install wrangler
npm install -g wrangler

# Login
wrangler login

# List all keys
wrangler kv:key list --namespace-id=YOUR_NAMESPACE_ID

# Get specific email
wrangler kv:key get "email:user@example.com" --namespace-id=YOUR_NAMESPACE_ID
```

### Export All Emails
Create a simple worker to export emails:

```javascript
export default {
  async fetch(request, env) {
    // Simple auth check
    const auth = request.headers.get('Authorization');
    if (auth !== 'Bearer YOUR_SECRET_KEY') {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // List all signups
    const list = await env.BETA_SIGNUPS.list({ prefix: 'signup:' });
    const emails = [];
    
    for (const key of list.keys) {
      const data = await env.BETA_SIGNUPS.get(key.name);
      if (data) {
        emails.push(JSON.parse(data));
      }
    }
    
    return new Response(JSON.stringify(emails, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

## Security Features

- **Rate Limiting**: 3 submissions per IP per hour
- **Email Validation**: Basic format checking
- **Duplicate Prevention**: Each email can only sign up once
- **CORS Protection**: Only accepts requests from vros.cat

## Monitoring

Check your worker analytics in Cloudflare Dashboard:
- Total requests
- Success/error rates
- Geographic distribution

## Costs

Free tier limits:
- 100,000 requests/day
- 1GB KV storage
- Unlimited KV reads

This is more than enough for thousands of signups!