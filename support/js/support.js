// VROS Support Center - Main JavaScript

// Configuration
const CONFIG = {
    githubRepo: 'catnet/vros',
    githubBugsRepo: 'catnet/vros-bugs',
    apiProxy: 'https://api.vros.cat', // Will be implemented via Cloudflare Worker
    updateInterval: 60000, // Update every minute
};

// GitHub API Helper
class GitHubAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    async fetchWithCache(url, cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            return data;
        } catch (error) {
            console.error(`Failed to fetch ${cacheKey}:`, error);
            return cached?.data || null;
        }
    }

    async getRecentIssues() {
        const url = `https://api.github.com/repos/${CONFIG.githubBugsRepo}/issues?state=all&per_page=30`;
        return this.fetchWithCache(url, 'recent-issues');
    }

    async getStats() {
        const [issues, closedIssues] = await Promise.all([
            this.fetchWithCache(
                `https://api.github.com/repos/${CONFIG.githubBugsRepo}/issues?state=open`,
                'open-issues'
            ),
            this.fetchWithCache(
                `https://api.github.com/repos/${CONFIG.githubBugsRepo}/issues?state=closed&per_page=100`,
                'closed-issues'
            )
        ]);

        return {
            open: issues?.length || 0,
            closed: closedIssues?.length || 0,
            total: (issues?.length || 0) + (closedIssues?.length || 0)
        };
    }
}

// UI Manager
class UIManager {
    constructor(api) {
        this.api = api;
        this.init();
    }

    init() {
        this.loadRecentActivity();
        this.loadStats();
        this.checkSystemStatus();
        
        // Periodic updates
        setInterval(() => {
            this.loadRecentActivity();
            this.loadStats();
        }, CONFIG.updateInterval);
    }

    async loadRecentActivity() {
        const issues = await this.api.getRecentIssues();
        if (!issues) return;

        // Categorize issues
        const recentFixes = [];
        const inProgress = [];
        const upcoming = [];

        issues.forEach(issue => {
            const labels = issue.labels.map(l => l.name);
            
            if (issue.state === 'closed' && recentFixes.length < 5) {
                recentFixes.push(issue);
            } else if (labels.includes('status:in-progress') && inProgress.length < 5) {
                inProgress.push(issue);
            } else if (labels.includes('type:feature') && issue.state === 'open' && upcoming.length < 5) {
                upcoming.push(issue);
            }
        });

        // Update UI
        this.renderIssueList('recent-fixes', recentFixes);
        this.renderIssueList('in-progress', inProgress);
        this.renderIssueList('upcoming', upcoming);
    }

    renderIssueList(elementId, issues) {
        const container = document.getElementById(elementId);
        if (!container) return;

        if (issues.length === 0) {
            container.innerHTML = '<div class="no-issues">No issues to display</div>';
            return;
        }

        container.innerHTML = issues.map(issue => `
            <div class="issue-item">
                <a href="${issue.html_url}" target="_blank" class="issue-title">
                    <span class="issue-number">#${issue.number}</span>
                    ${this.escapeHtml(issue.title)}
                </a>
                ${this.renderLabels(issue.labels)}
            </div>
        `).join('');
    }

    renderLabels(labels) {
        if (!labels || labels.length === 0) return '';
        
        return `
            <div class="issue-labels">
                ${labels.map(label => {
                    const type = this.getLabelType(label.name);
                    return `<span class="label label-${type}">${this.escapeHtml(label.name)}</span>`;
                }).join('')}
            </div>
        `;
    }

    getLabelType(labelName) {
        if (labelName.includes('bug')) return 'bug';
        if (labelName.includes('feature')) return 'feature';
        if (labelName.includes('enhancement')) return 'enhancement';
        return 'default';
    }

    async loadStats() {
        const stats = await this.api.getStats();
        
        // Update stat cards
        this.updateStatCard('issues-resolved', stats.closed);
        this.updateStatCard('open-issues', stats.open);
        
        // Calculate average resolution time (mock for now)
        this.updateStatCard('avg-resolution', '~3 days');
        
        // Community size (mock for now)
        this.updateStatCard('community-size', '1.2k+');
    }

    updateStatCard(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.classList.add('stat-updated');
            setTimeout(() => element.classList.remove('stat-updated'), 300);
        }
    }

    checkSystemStatus() {
        // Check if API is responsive
        fetch('https://api.github.com/rate_limit')
            .then(response => {
                const statusText = document.getElementById('status-text');
                const statusDot = document.querySelector('.status-dot');
                
                if (response.ok) {
                    statusText.textContent = 'All systems operational';
                    statusDot.className = 'status-dot status-ok';
                } else {
                    statusText.textContent = 'Degraded performance';
                    statusDot.className = 'status-dot status-warning';
                }
            })
            .catch(() => {
                const statusText = document.getElementById('status-text');
                const statusDot = document.querySelector('.status-dot');
                statusText.textContent = 'Connection issues';
                statusDot.className = 'status-dot status-error';
            });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Theme Manager
class ThemeManager {
    constructor() {
        // Always use dark theme - no toggle needed
        document.documentElement.setAttribute('data-theme', 'dark');
        
        // Ensure dark theme persists
        this.enforceDarkTheme();
    }

    enforceDarkTheme() {
        // Override any system preferences
        if (window.matchMedia) {
            const meta = document.createElement('meta');
            meta.name = 'color-scheme';
            meta.content = 'dark';
            document.head.appendChild(meta);
        }
    }
}

// App Token Manager
class AppTokenManager {
    constructor() {
        this.tokenKey = 'vros-app-token';
        this.token = this.getOrCreateToken();
    }

    getOrCreateToken() {
        let token = localStorage.getItem(this.tokenKey);
        if (!token) {
            token = this.generateToken();
            localStorage.setItem(this.tokenKey, token);
        }
        return token;
    }

    generateToken() {
        return 'vros-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
    }

    getToken() {
        return this.token;
    }
}

// URL Parameter Handler
class URLParamHandler {
    constructor() {
        this.params = new URLSearchParams(window.location.search);
        this.handleAppRedirect();
    }

    handleAppRedirect() {
        // If coming from app, store additional info
        if (this.params.has('from') && this.params.get('from') === 'app') {
            const version = this.params.get('version');
            const system = this.params.get('system');
            
            if (version) sessionStorage.setItem('app-version', version);
            if (system) sessionStorage.setItem('app-system', system);
            
            // Show a welcome message for app users
            this.showAppWelcome();
        }
    }

    showAppWelcome() {
        const hero = document.querySelector('.hero');
        if (hero) {
            const welcome = document.createElement('div');
            welcome.className = 'app-welcome';
            welcome.innerHTML = `
                <div style="background: var(--accent-dim); color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; display: inline-block;">
                    Welcome from VROS App v${sessionStorage.getItem('app-version') || 'unknown'}
                </div>
            `;
            hero.insertBefore(welcome, hero.firstChild);
        }
    }
}

// Smooth scroll for navigation
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Add animation class for stat updates
const style = document.createElement('style');
style.textContent = `
    .stat-updated {
        animation: pulse-value 0.3s ease;
    }
    
    @keyframes pulse-value {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    
    .no-issues {
        padding: 1rem;
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
    }
    
    .app-welcome {
        animation: slideDown 0.5s ease;
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const api = new GitHubAPI();
    const ui = new UIManager(api);
    const theme = new ThemeManager();
    const token = new AppTokenManager();
    const urlHandler = new URLParamHandler();
    
    initSmoothScroll();
    
    // Store token for bug reports
    window.VROS = {
        token: token.getToken(),
        api: api,
        ui: ui
    };
    
    console.log('VROS Support Center initialized');
});