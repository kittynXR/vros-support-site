/**
 * GitHub API Integration for VROS Bug Tracker
 * Handles all communication with GitHub Issues via Cloudflare Worker proxy
 */

class GitHubAPI {
  constructor() {
    // Use Cloudflare Worker in production, direct GitHub API in development
    this.apiBase = import.meta.env.PROD 
      ? 'https://api.vros.cat'
      : 'http://localhost:8787/api'; // Cloudflare Worker local dev
    
    this.githubBase = 'https://api.github.com';
    this.owner = 'catnet-systems';
    this.repo = 'vros-bugs';
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * Get or create app token for authentication
   */
  getAppToken() {
    let token = localStorage.getItem('vros-app-token');
    if (!token) {
      token = `vros-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('vros-app-token', token);
    }
    return token;
  }

  /**
   * Make authenticated request to API
   */
  async request(endpoint, options = {}) {
    const url = `${this.apiBase}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'X-App-Token': this.getAppToken()
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error ${response.status}: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  /**
   * Fetch issues with optional filters
   */
  async getIssues(filters = {}) {
    const params = new URLSearchParams({
      state: filters.state || 'open',
      labels: filters.labels || '',
      sort: filters.sort || 'created',
      direction: filters.direction || 'desc',
      per_page: filters.per_page || '100'
    });

    // Check cache
    const cacheKey = `issues:${params.toString()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Fetch from API
    const issues = await this.request(`/issues?${params}`);
    
    // Process and categorize issues by column
    const categorized = this.categorizeIssues(issues);
    
    // Cache result
    this.cache.set(cacheKey, {
      data: categorized,
      timestamp: Date.now()
    });

    return categorized;
  }

  /**
   * Categorize issues into Kanban columns based on labels
   */
  categorizeIssues(issues) {
    const columns = {
      backlog: [],
      todo: [],
      inProgress: [],
      testing: [],
      done: []
    };

    issues.forEach(issue => {
      const labels = issue.labels.map(l => l.name);
      
      // Determine column based on status label
      let column = 'backlog'; // default
      
      if (labels.includes('status:done') || issue.state === 'closed') {
        column = 'done';
      } else if (labels.includes('status:testing')) {
        column = 'testing';
      } else if (labels.includes('status:in-progress')) {
        column = 'inProgress';
      } else if (labels.includes('status:todo')) {
        column = 'todo';
      }

      // Parse issue into card format
      columns[column].push(this.parseIssue(issue));
    });

    return columns;
  }

  /**
   * Parse GitHub issue into card format
   */
  parseIssue(issue) {
    return {
      id: issue.number.toString(),
      number: issue.number,
      title: issue.title,
      description: issue.body || '',
      url: issue.html_url,
      state: issue.state,
      labels: issue.labels,
      assignee: issue.assignee,
      assignees: issue.assignees,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      comments: issue.comments,
      severity: this.getSeverity(issue.labels),
      category: this.getCategory(issue.labels)
    };
  }

  /**
   * Extract severity from labels
   */
  getSeverity(labels) {
    const severityLabel = labels.find(l => l.name.startsWith('severity:'));
    return severityLabel ? severityLabel.name.split(':')[1] : 'medium';
  }

  /**
   * Extract category from labels
   */
  getCategory(labels) {
    const categoryLabel = labels.find(l => l.name.startsWith('category:'));
    return categoryLabel ? categoryLabel.name.split(':')[1] : 'general';
  }

  /**
   * Update issue labels (for drag-and-drop)
   */
  async updateIssueLabels(issueNumber, newStatus) {
    // Remove old status labels
    const statusLabels = [
      'status:backlog',
      'status:todo',
      'status:in-progress',
      'status:testing',
      'status:done'
    ];

    // Get current issue to preserve non-status labels
    const currentIssue = await this.request(`/issues/${issueNumber}`);
    const currentLabels = currentIssue.labels
      .map(l => l.name)
      .filter(name => !statusLabels.includes(name));

    // Add new status label
    const newLabels = [...currentLabels, `status:${newStatus}`];

    // Update via API
    const response = await this.request(`/issues/${issueNumber}/labels`, {
      method: 'PUT',
      body: JSON.stringify({ labels: newLabels })
    });

    // Clear cache
    this.cache.clear();

    return response;
  }

  /**
   * Create a new issue (bug report)
   */
  async createIssue(bugData) {
    const response = await this.request('/submit-bug', {
      method: 'POST',
      body: JSON.stringify(bugData)
    });

    // Clear cache
    this.cache.clear();

    return response;
  }

  /**
   * Get repository statistics
   */
  async getStats() {
    const cacheKey = 'stats';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.data;
    }

    const stats = await this.request('/stats');
    
    this.cache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });

    return stats;
  }

  /**
   * Search issues locally (client-side filtering)
   */
  searchIssues(issues, query) {
    const searchTerm = query.toLowerCase();
    const results = {};

    Object.entries(issues).forEach(([column, cards]) => {
      results[column] = cards.filter(card => {
        return (
          card.title.toLowerCase().includes(searchTerm) ||
          card.description.toLowerCase().includes(searchTerm) ||
          card.number.toString().includes(searchTerm) ||
          card.labels.some(l => l.name.toLowerCase().includes(searchTerm))
        );
      });
    });

    return results;
  }

  /**
   * Filter issues by criteria
   */
  filterIssues(issues, filters) {
    const results = {};

    Object.entries(issues).forEach(([column, cards]) => {
      results[column] = cards.filter(card => {
        // Filter by severity
        if (filters.severity && filters.severity !== 'all') {
          if (card.severity !== filters.severity) return false;
        }

        // Filter by category
        if (filters.category && filters.category !== 'all') {
          if (card.category !== filters.category) return false;
        }

        // Filter by assignee
        if (filters.assignee && filters.assignee !== 'all') {
          if (!card.assignee || card.assignee.login !== filters.assignee) {
            return false;
          }
        }

        // Filter by date range
        if (filters.dateFrom) {
          const cardDate = new Date(card.created_at);
          const filterDate = new Date(filters.dateFrom);
          if (cardDate < filterDate) return false;
        }

        if (filters.dateTo) {
          const cardDate = new Date(card.created_at);
          const filterDate = new Date(filters.dateTo);
          if (cardDate > filterDate) return false;
        }

        return true;
      });
    });

    return results;
  }

  /**
   * Get patch notes
   */
  async getPatchNotes() {
    return await this.request('/patch-notes');
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const githubAPI = new GitHubAPI();
export default githubAPI;