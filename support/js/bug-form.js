/**
 * VROS Bug Report Form Handler
 * Handles form validation, submission, and system info detection
 */

// API Configuration
const API_CONFIG = {
  // Use Cloudflare Worker in production
  apiBase: window.location.hostname === 'localhost' 
    ? 'http://localhost:8787/api'
    : 'https://vros-api.hbrdzn8ttn.workers.dev/api',
  
  // GitHub repository for direct links
  githubRepo: 'https://github.com/catnet-systems/vros-bugs'
};

// Form Handler Class
class BugFormHandler {
  constructor() {
    this.form = document.getElementById('bug-report-form');
    this.successMessage = document.getElementById('success-message');
    this.errorMessage = document.getElementById('error-message');
    this.systemInfo = {};
    
    if (this.form) {
      this.init();
    }
  }

  init() {
    // Detect system info on load
    this.detectSystemInfo();
    
    // Add form submit handler
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Add character counters
    this.addCharacterCounters();
    
    // Load app info if coming from app
    this.loadAppInfo();
  }

  /**
   * Detect system information
   */
  detectSystemInfo() {
    // Detect OS
    const platform = navigator.platform;
    let os = 'Unknown';
    if (platform.includes('Win')) os = 'Windows';
    else if (platform.includes('Mac')) os = 'macOS';
    else if (platform.includes('Linux')) os = 'Linux';
    
    document.getElementById('os-info').textContent = os;
    this.systemInfo.os = os;

    // Detect Browser
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    
    document.getElementById('browser-info').textContent = browser;
    this.systemInfo.browser = browser;

    // Get app version if available
    const appVersion = sessionStorage.getItem('app-version');
    if (appVersion) {
      document.getElementById('version-info').textContent = appVersion;
      this.systemInfo.version = appVersion;
    }

    // Get screen resolution
    this.systemInfo.resolution = `${window.screen.width}x${window.screen.height}`;
    
    // Get user agent for debugging
    this.systemInfo.userAgent = userAgent;
  }

  /**
   * Load app information from URL params
   */
  loadAppInfo() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('from') && params.get('from') === 'app') {
      // Mark as from app
      this.systemInfo.fromApp = true;
      
      // Load version
      if (params.has('version')) {
        const version = params.get('version');
        document.getElementById('version-info').textContent = version;
        this.systemInfo.version = version;
      }
      
      // Load system info
      if (params.has('system')) {
        try {
          const systemData = JSON.parse(decodeURIComponent(params.get('system')));
          Object.assign(this.systemInfo, systemData);
        } catch (e) {
          console.error('Failed to parse system data:', e);
        }
      }
      
      // Show app-specific UI
      this.showAppUI();
    }
  }

  /**
   * Show UI elements for app users
   */
  showAppUI() {
    // Add a badge showing this is from the app
    const badge = document.createElement('div');
    badge.className = 'app-badge';
    badge.innerHTML = '✓ Submitting from VROS App';
    badge.style.cssText = `
      background: var(--accent);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      text-align: center;
    `;
    this.form.insertBefore(badge, this.form.firstChild);
  }

  /**
   * Add character counters to textareas
   */
  addCharacterCounters() {
    const textareas = this.form.querySelectorAll('textarea');
    
    textareas.forEach(textarea => {
      const maxLength = 2000; // Max length for descriptions
      const counter = document.createElement('div');
      counter.className = 'char-counter';
      counter.textContent = `0 / ${maxLength}`;
      
      textarea.parentNode.appendChild(counter);
      
      textarea.addEventListener('input', () => {
        const length = textarea.value.length;
        counter.textContent = `${length} / ${maxLength}`;
        
        if (length > maxLength * 0.9) {
          counter.classList.add('warning');
        } else {
          counter.classList.remove('warning');
        }
        
        if (length > maxLength) {
          counter.classList.add('error');
          textarea.value = textarea.value.substring(0, maxLength);
        } else {
          counter.classList.remove('error');
        }
      });
    });
  }

  /**
   * Validate form data
   */
  validateForm(formData) {
    const errors = [];
    
    // Check required fields
    if (!formData.title || formData.title.trim().length < 5) {
      errors.push('Title must be at least 5 characters');
    }
    
    if (!formData.description || formData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters');
    }
    
    // Validate email if provided
    if (formData.email && !this.validateEmail(formData.email)) {
      errors.push('Invalid email address');
    }
    
    return errors;
  }

  /**
   * Validate email address
   */
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  /**
   * Handle form submission
   */
  async handleSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData);
    
    // Validate
    const errors = this.validateForm(data);
    if (errors.length > 0) {
      this.showError(errors.join('<br>'));
      return;
    }
    
    // Prepare bug data
    const bugData = {
      title: data.title,
      description: data.description,
      severity: data.severity,
      category: data.category,
      steps: data.steps,
      expected: data.expected,
      actual: data.actual,
      additional: data.additional,
      systemInfo: {
        ...this.systemInfo,
        headset: data.headset
      },
      contact: {
        email: data.email,
        discord: data.discord
      }
    };
    
    // Show loading state
    this.setSubmitButtonLoading(true);
    
    try {
      // Submit to API
      const response = await this.submitBug(bugData);
      
      if (response.success) {
        this.showSuccess(response);
      } else {
        this.showError(response.error || 'Submission failed');
      }
    } catch (error) {
      console.error('Submission error:', error);
      this.showError('Failed to submit bug report. Please try again.');
    } finally {
      this.setSubmitButtonLoading(false);
    }
  }

  /**
   * Submit bug to API
   */
  async submitBug(bugData) {
    const token = this.getAppToken();
    
    const response = await fetch(`${API_CONFIG.apiBase}/submit-bug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': token
      },
      body: JSON.stringify(bugData)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    
    return await response.json();
  }

  /**
   * Get or create app token
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
   * Show success message
   */
  showSuccess(response) {
    // Hide form
    this.form.style.display = 'none';
    
    // Update success message
    if (response.issueNumber) {
      document.getElementById('issue-id').textContent = `#${response.issueNumber}`;
      
      const issueLink = document.getElementById('issue-link');
      if (issueLink && response.issueUrl) {
        issueLink.href = response.issueUrl;
      }
    }
    
    // Show success message
    this.successMessage.style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Show error message
   */
  showError(message) {
    document.getElementById('error-text').innerHTML = message;
    this.errorMessage.style.display = 'block';
    
    // Scroll to error
    this.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Hide after 10 seconds
    setTimeout(() => {
      this.errorMessage.style.display = 'none';
    }, 10000);
  }

  /**
   * Set submit button loading state
   */
  setSubmitButtonLoading(isLoading) {
    const submitBtn = this.form.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    
    if (isLoading) {
      submitBtn.classList.add('btn-loading');
      submitBtn.disabled = true;
    } else {
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
    }
  }
}

/**
 * Retry submission function (global for onclick)
 */
window.retrySubmission = function() {
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.style.display = 'none';
  }
  
  // Scroll back to form
  const form = document.getElementById('bug-report-form');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BugFormHandler();
  
  // Add smooth scroll for all internal links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
  
  // Enhance keyboard navigation
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach((input, index) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && input.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const nextInput = inputs[index + 1];
        if (nextInput) {
          nextInput.focus();
        } else {
          // Submit form if at last input
          const form = input.closest('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }
    });
  });
  
  console.log('VROS Bug Form initialized');
});