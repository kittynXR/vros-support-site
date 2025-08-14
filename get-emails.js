#!/usr/bin/env node

// Script to retrieve emails from VROS beta signups
// Usage: node get-emails.js <admin-key>

const WORKER_URL = 'https://beta-api.vros.cat/admin/export';

async function getEmails(adminKey) {
  try {
    const response = await fetch(WORKER_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error:', error.error || response.statusText);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log(`Total signups: ${data.totalCount}`);
    console.log('\nEmails (newest first):');
    console.log('======================\n');
    
    data.emails.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.email}`);
      console.log(`   Signed up: ${new Date(entry.timestamp).toLocaleString()}`);
      console.log(`   IP: ${entry.ip}`);
      console.log(`   ID: ${entry.id}`);
      console.log('');
    });

    // Also save to CSV
    const csv = [
      'Email,Signup Date,IP',
      ...data.emails.map(e => `${e.email},${e.timestamp},${e.ip}`)
    ].join('\n');
    
    const fs = require('fs');
    fs.writeFileSync('beta-signups.csv', csv);
    console.log('Saved to beta-signups.csv');

  } catch (error) {
    console.error('Failed to fetch emails:', error.message);
    process.exit(1);
  }
}

// Check command line arguments
const adminKey = process.argv[2];

if (!adminKey) {
  console.log('Usage: node get-emails.js <admin-key>');
  console.log('\nFirst, set your admin key in Cloudflare Worker settings:');
  console.log('1. Go to your worker settings');
  console.log('2. Add environment variable: ADMIN_KEY = your-secret-key');
  console.log('3. Then run: node get-emails.js your-secret-key');
  process.exit(1);
}

getEmails(adminKey);