# VROS Bug Tracking System - End-to-End Test Plan

## Overview
This document outlines the testing procedures for the complete bug tracking system, including the support site, bug submission form, Kanban board, and application integrations.

## Test Environment Setup

### Prerequisites
1. Local development server running (`npm run dev` in vros_site)
2. Bug tracker React app built (`npm run build` in bugs-tracker)
3. Cloudflare Worker deployed or running locally with Miniflare
4. GitHub repository with Issues enabled
5. Test applications (desktop-core and vros-dashboard) built

### Test Data
- Test GitHub repository: `catnet/vros-bugs` (or test repo)
- Test user email: `test@vros.cat`
- Test Discord: `testuser#1234`

## Test Scenarios

### 1. Support Site Navigation
**Objective**: Verify all pages load correctly with dark theme

**Steps**:
1. Navigate to http://localhost:8080
2. Verify dark theme (#0d0d0d background)
3. Click "Report a Bug" button
4. Click "View All Issues" button
5. Navigate back to home

**Expected Results**:
- [ ] All pages load without errors
- [ ] Dark theme is applied consistently
- [ ] Navigation works smoothly
- [ ] No flash of white/light content

### 2. Bug Submission - Web User
**Objective**: Test bug submission from web without app token

**Steps**:
1. Navigate to /report-bug
2. Fill in form:
   - Title: "Test Bug from Web"
   - Severity: High
   - Category: UI/UX
   - Description: "This is a test bug submission"
   - Steps: "1. Open app\n2. Click button\n3. See error"
   - Expected: "Button should work"
   - Actual: "Button shows error"
   - Email: "test@example.com"
3. Submit form

**Expected Results**:
- [ ] Form validates all required fields
- [ ] Character counters work
- [ ] System info auto-detected
- [ ] Submission succeeds
- [ ] Success message shows issue number
- [ ] Rate limiting works (test multiple rapid submissions)

### 3. Bug Submission - From Desktop App
**Objective**: Test bug submission from desktop-core About dialog

**Steps**:
1. Run desktop-core application
2. Click "About" in system tray or main window
3. Click "Report a Bug" button
4. Verify URL includes app parameters
5. Fill and submit bug form

**Expected Results**:
- [ ] Browser opens with pre-filled app info
- [ ] App token is generated and included
- [ ] Version info is passed correctly
- [ ] System info includes desktop-core context
- [ ] Submission bypasses some rate limits

### 4. Bug Submission - From VR Dashboard
**Objective**: Test bug submission from vros-dashboard About section

**Steps**:
1. Launch vros-dashboard in VR
2. Click "ℹ About" button in header
3. Click "Report a Bug" in About window
4. Submit bug from opened browser

**Expected Results**:
- [ ] Browser/overlay opens correctly
- [ ] VR context is included in system info
- [ ] App token includes vros-dashboard identifier
- [ ] Submission works from VR environment

### 5. Kanban Board - View Issues
**Objective**: Test issue viewing and categorization

**Steps**:
1. Navigate to https://bugs.vros.cat (or localhost)
2. Wait for issues to load
3. Verify columns: Backlog, Todo, In Progress, Testing, Done
4. Check issue cards display correctly

**Expected Results**:
- [ ] Issues load from GitHub
- [ ] Proper categorization by labels
- [ ] Cards show: number, title, severity, labels
- [ ] Auto-refresh every 30 seconds
- [ ] Loading states work correctly

### 6. Kanban Board - Drag and Drop
**Objective**: Test moving issues between columns

**Steps**:
1. Drag an issue from Backlog to Todo
2. Drag another from Todo to In Progress
3. Drag from In Progress to Testing
4. Drag from Testing to Done

**Expected Results**:
- [ ] Drag preview shows correctly
- [ ] Drop zones highlight on hover
- [ ] Cards animate smoothly
- [ ] GitHub labels update via API
- [ ] Changes persist on refresh

### 7. Kanban Board - Filtering
**Objective**: Test issue filtering functionality

**Steps**:
1. Search for specific issue text
2. Filter by severity (Critical, High, Medium, Low)
3. Filter by category (VR, UI, Performance, etc.)
4. Combine multiple filters
5. Clear all filters

**Expected Results**:
- [ ] Search works across title and description
- [ ] Filters apply correctly
- [ ] Multiple filters combine (AND logic)
- [ ] Clear filters button works
- [ ] Filtered state is visually indicated

### 8. Patch Notes Integration
**Objective**: Test patch notes display in apps

**Steps**:
1. Open desktop-core About dialog
2. Expand "What's New" section
3. Open vros-dashboard About window
4. Expand "What's New" section
5. Check API endpoint: /api/patch-notes

**Expected Results**:
- [ ] Patch notes display correctly
- [ ] Version 0.1.0 information shown
- [ ] Formatting is preserved
- [ ] API returns cached data when available

### 9. Latest Version Check
**Objective**: Test version checking functionality

**Steps**:
1. Call API endpoint: /api/latest-version
2. Verify response structure
3. Check update availability logic

**Expected Results**:
- [ ] Returns current version (0.1.0)
- [ ] updateAvailable flag works
- [ ] Download URL is correct
- [ ] Cache headers are set

### 10. Error Handling
**Objective**: Test error scenarios

**Steps**:
1. Submit bug with network disconnected
2. Try to access with invalid app token
3. Submit with missing required fields
4. Exceed rate limits
5. Try XSS in bug description

**Expected Results**:
- [ ] Graceful offline handling
- [ ] Clear error messages
- [ ] Validation prevents submission
- [ ] Rate limit message shown
- [ ] XSS is sanitized/prevented

## Performance Tests

### Load Testing
- [ ] Support site loads in < 2 seconds
- [ ] Bug tracker loads in < 3 seconds
- [ ] API responses < 500ms (cached)
- [ ] Drag and drop is smooth (60 FPS)

### Stress Testing
- [ ] Handle 100+ issues in Kanban board
- [ ] Handle 50 rapid bug submissions
- [ ] Multiple users accessing simultaneously

## Security Tests

### Authentication
- [ ] App tokens are validated
- [ ] Rate limiting by IP works
- [ ] CORS headers are correct
- [ ] No sensitive data exposed

### Data Validation
- [ ] XSS prevention in all inputs
- [ ] SQL injection not possible
- [ ] File upload restrictions (if applicable)
- [ ] GitHub token not exposed

## Accessibility Tests

### Keyboard Navigation
- [ ] Tab through all form fields
- [ ] Enter submits forms
- [ ] Escape closes modals
- [ ] Arrow keys work in dropdowns

### Screen Reader
- [ ] ARIA labels present
- [ ] Form labels associated
- [ ] Error messages announced
- [ ] Success messages announced

### Visual
- [ ] Sufficient color contrast
- [ ] Text is readable
- [ ] Focus indicators visible
- [ ] No color-only information

## Browser Compatibility

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

## Deployment Tests

### GitHub Pages
- [ ] Site deploys successfully
- [ ] Custom domain works
- [ ] HTTPS is enabled
- [ ] All assets load

### Cloudflare Worker
- [ ] Worker deploys successfully
- [ ] Environment variables set
- [ ] KV namespaces connected
- [ ] Rate limiting works

## Post-Deployment Monitoring

- [ ] Error tracking configured
- [ ] Analytics working
- [ ] Performance monitoring
- [ ] Uptime monitoring

## Sign-off Checklist

- [ ] All test scenarios pass
- [ ] No critical bugs remain
- [ ] Performance meets requirements
- [ ] Security review complete
- [ ] Documentation updated
- [ ] Deployment successful

## Test Results

| Test Category | Pass | Fail | N/A | Notes |
|--------------|------|------|-----|-------|
| Navigation   |  ✓   |      |     |       |
| Bug Submission |    |      |     | Pending Worker setup |
| Kanban Board |  ✓   |      |     |       |
| Integration  |      |      |  ✓  | Requires full deployment |
| Performance  |  ✓   |      |     |       |
| Security     |      |      |     | Needs review |
| Accessibility|      |      |     | Needs testing |

---

**Test Plan Version**: 1.0
**Last Updated**: 2025-01-13
**Next Review**: After initial deployment