// Main JavaScript for VROS Landing Page

// Smooth scroll behavior for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = 80; // Height of fixed navbar
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    // Add background to navbar when scrolled
    if (currentScroll > 50) {
        navbar.style.background = 'rgba(10, 10, 10, 0.95)';
        navbar.style.backdropFilter = 'blur(20px)';
    } else {
        navbar.style.background = 'rgba(10, 10, 10, 0.8)';
        navbar.style.backdropFilter = 'blur(20px)';
    }
    
    lastScroll = currentScroll;
});

// Counter animation
function animateCounter(element, duration = 2000) {
    const target = parseInt(element.getAttribute('data-counter'));
    const increment = target / (duration / 16); // 60fps
    let current = 0;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Animate fade-in elements
            if (entry.target.classList.contains('animate-fade-in-up')) {
                entry.target.style.animationDelay = `${entry.target.dataset.delay || 0}ms`;
                entry.target.classList.add('animated');
            }
            
            // Animate counters
            if (entry.target.hasAttribute('data-counter')) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
            
            // Animate benchmark bars
            if (entry.target.classList.contains('benchmark-bar')) {
                entry.target.style.setProperty('--width', entry.target.style.getPropertyValue('--width'));
            }
        }
    });
}, observerOptions);

// Observe elements on page load
document.addEventListener('DOMContentLoaded', () => {
    // Add animation classes to elements
    document.querySelectorAll('.hero-content > *').forEach((el, index) => {
        el.classList.add('animate-fade-in-up');
        el.dataset.delay = index * 100;
    });
    
    document.querySelectorAll('.feature-card').forEach((el, index) => {
        el.classList.add('animate-fade-in-up');
        el.dataset.delay = index * 50;
    });
    
    document.querySelectorAll('.stat-card').forEach((el, index) => {
        el.classList.add('animate-fade-in-up');
        el.dataset.delay = index * 100;
    });
    
    // Start observing
    document.querySelectorAll('.animate-fade-in-up').forEach(el => {
        observer.observe(el);
    });
    
    document.querySelectorAll('[data-counter]').forEach(el => {
        observer.observe(el);
    });
    
    document.querySelectorAll('.benchmark-bar').forEach(el => {
        observer.observe(el);
    });
    
    // Performance card number animation
    animatePerformanceMetrics();
});

// Animate performance metrics in hero section
function animatePerformanceMetrics() {
    const perfValues = document.querySelectorAll('.perf-value');
    
    perfValues.forEach(element => {
        const target = parseFloat(element.getAttribute('data-value'));
        const isDecimal = target % 1 !== 0;
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            if (isDecimal) {
                element.textContent = current.toFixed(1);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 16);
    });
}

// Add hover effect to cards
document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.feature-card, .stat-card, .use-case-card, .tech-feature');
    
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const percentX = (x - centerX) / centerX;
            const percentY = (y - centerY) / centerY;
            
            card.style.transform = `perspective(1000px) rotateY(${percentX * 2}deg) rotateX(${-percentY * 2}deg) translateZ(10px)`;
        }
    });
});

// Reset card transform on mouse leave
document.addEventListener('mouseout', (e) => {
    if (e.target.matches('.feature-card, .stat-card, .use-case-card, .tech-feature')) {
        e.target.style.transform = '';
    }
});

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.hero-visual');
    
    parallaxElements.forEach(element => {
        const speed = 0.5;
        element.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Add loading animation
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});

// Email signup form handling
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('beta-signup-form');
    const emailInput = document.getElementById('email-input');
    const messageDiv = document.getElementById('form-message');
    const submitButton = form.querySelector('.btn-submit');
    
    // Worker URL for beta signups
    const WORKER_URL = 'https://beta-api.vros.cat';
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous messages
        messageDiv.textContent = '';
        messageDiv.className = 'form-message';
        
        // Disable form during submission
        emailInput.disabled = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        
        try {
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: emailInput.value.trim(),
                }),
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Success
                messageDiv.textContent = data.message;
                messageDiv.className = 'form-message success';
                
                // Clear form on success
                if (!data.duplicate) {
                    emailInput.value = '';
                }
                
                // Update progress bar (optional)
                if (data.totalCount) {
                    const percentage = Math.min(95, (data.totalCount / 1000) * 100);
                    document.querySelector('.progress-fill').style.width = `${percentage}%`;
                }
            } else {
                // Error
                messageDiv.textContent = data.error || 'Something went wrong. Please try again.';
                messageDiv.className = 'form-message error';
            }
        } catch (error) {
            console.error('Submission error:', error);
            messageDiv.textContent = 'Network error. Please check your connection and try again.';
            messageDiv.className = 'form-message error';
        } finally {
            // Re-enable form
            emailInput.disabled = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Reserve My Spot';
        }
    });
});

// Console Easter egg
console.log('%c🚀 VROS - The High-Performance VR Overlay System', 'font-size: 20px; font-weight: bold; color: #7c3aed;');
console.log('%cBuilt for creators who demand the best. <25μs latency, 144Hz support, enterprise-grade performance.', 'font-size: 14px; color: #a78bfa;');
// GitHub references removed
console.log('%cInterested in contributing? Check out our documentation at docs.vros.cat', 'font-size: 12px; color: #06b6d4;');