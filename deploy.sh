#!/bin/bash

# VROS Site Deployment Script
# Deploys support site and bug tracker to GitHub Pages

set -e

echo "🚀 Starting VROS Site deployment..."

# Build the bug tracker React app
echo "📦 Building bug tracker..."
cd bugs-tracker
npm install
npm run build
cd ..

# Copy bug tracker build to main site
echo "📋 Copying bug tracker to site..."
rm -rf bugs/
cp -r bugs-tracker/dist/ bugs/

# Create CNAME file for custom domain
echo "🌐 Setting up custom domain..."
echo "support.vros.cat" > CNAME

# Create .nojekyll file to prevent Jekyll processing
touch .nojekyll

# Create deployment info
echo "📝 Creating deployment info..."
cat > deployment-info.json <<EOF
{
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": "0.1.0",
  "environment": "production"
}
EOF

echo "✅ Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Commit these changes to your repository"
echo "2. Push to the 'gh-pages' branch (or configure GitHub Pages to use main branch)"
echo "3. Configure GitHub Pages in repository settings"
echo "4. Set up Cloudflare Worker at api.vros.cat"
echo ""
echo "Site structure:"
echo "  / - Main support hub"
echo "  /report-bug - Bug submission form"
echo "  /bugs - Bug tracker (Kanban board)"
echo "  /data - Static data (patch notes, etc.)"