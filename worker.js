// Cloudflare Worker for VROS Beta Signup
// This worker handles email collection with spam protection and rate limiting

// Configuration
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://vros.cat',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const RATE_LIMIT_MAX = 3; // Max submissions per IP per hour

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Handle CORS preflight requests
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// Rate limiting check
async function isRateLimited(ip, env) {
  const key = `rate_limit:${ip}`;
  const count = await env.BETA_SIGNUPS.get(key);
  
  if (count && parseInt(count) >= RATE_LIMIT_MAX) {
    return true;
  }
  
  return false;
}

// Increment rate limit counter
async function incrementRateLimit(ip, env) {
  const key = `rate_limit:${ip}`;
  const count = await env.BETA_SIGNUPS.get(key);
  const newCount = count ? parseInt(count) + 1 : 1;
  
  await env.BETA_SIGNUPS.put(key, newCount.toString(), {
    expirationTtl: RATE_LIMIT_WINDOW,
  });
}

// Store email in KV
async function storeEmail(email, ip, env) {
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();
  
  // Store email data
  const emailData = {
    email,
    ip,
    timestamp,
    id,
  };
  
  // Store in KV with email as key (prevents duplicates)
  await env.BETA_SIGNUPS.put(`email:${email}`, JSON.stringify(emailData));
  
  // Also store by ID for listing
  await env.BETA_SIGNUPS.put(`signup:${id}`, JSON.stringify(emailData));
  
  // Increment total count
  const countKey = 'total_signups';
  const currentCount = await env.BETA_SIGNUPS.get(countKey);
  const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
  await env.BETA_SIGNUPS.put(countKey, newCount.toString());
  
  return newCount;
}

// Main request handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }
    
    // Handle admin export endpoint
    const url = new URL(request.url);
    if (url.pathname === '/admin/export' && request.method === 'GET') {
      // Check for admin authorization
      const auth = request.headers.get('Authorization');
      const adminKey = env.ADMIN_KEY || 'your-secret-admin-key'; // Set this as an environment variable
      
      if (auth !== `Bearer ${adminKey}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Export all emails
      const emails = [];
      const list = await env.BETA_SIGNUPS.list({ prefix: 'signup:' });
      
      for (const key of list.keys) {
        const data = await env.BETA_SIGNUPS.get(key.name);
        if (data) {
          emails.push(JSON.parse(data));
        }
      }
      
      // Get total count
      const totalCount = await env.BETA_SIGNUPS.get('total_signups');
      
      return new Response(JSON.stringify({
        totalCount: totalCount ? parseInt(totalCount) : emails.length,
        emails: emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Only accept POST requests for signup
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Get request data
      const contentType = request.headers.get('content-type') || '';
      let email;
      
      if (contentType.includes('application/json')) {
        const json = await request.json();
        email = json.email;
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        email = formData.get('email');
      } else {
        return new Response(JSON.stringify({ error: 'Invalid content type' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Validate email
      if (!email || !EMAIL_REGEX.test(email)) {
        return new Response(JSON.stringify({ error: 'Invalid email address' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Get client IP
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      // Check rate limiting
      if (await isRateLimited(ip, env)) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Check if email already exists
      const existingEmail = await env.BETA_SIGNUPS.get(`email:${email}`);
      if (existingEmail) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'You\'re already on the list! We\'ll notify you when beta access opens.',
          duplicate: true 
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Store email and increment rate limit
      const totalCount = await storeEmail(email, ip, env);
      await incrementRateLimit(ip, env);
      
      // Send success response
      return new Response(JSON.stringify({
        success: true,
        message: 'Success! You\'re on the beta list. Check your email for updates.',
        totalCount,
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};