import React, { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import '../styles/kanban.css';

/**
 * IssueCard Component - Draggable card representing a GitHub issue
 */
const IssueCard = memo(({ issue, index }) => {
  // Severity colors
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  // Category icons
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'vr': return '🥽';
      case 'overlay': return '📐';
      case 'performance': return '⚡';
      case 'ui': return '🎨';
      case 'audio': return '🔊';
      case 'input': return '🎮';
      default: return '📋';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Handle card click
  const handleCardClick = (e) => {
    // Don't open if clicking on interactive elements
    if (e.target.closest('.card-actions')) return;
    
    // Open issue in new tab
    window.open(issue.url, '_blank');
  };

  return (
    <Draggable draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`issue-card ${snapshot.isDragging ? 'dragging' : ''}`}
          onClick={handleCardClick}
        >
          {/* Card Header */}
          <div className="card-header">
            <span className="issue-number">#{issue.number}</span>
            <div className="card-actions">
              <button 
                className="action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement quick actions menu
                }}
                title="Quick actions"
              >
                ⋮
              </button>
            </div>
          </div>

          {/* Card Title */}
          <h4 className="card-title">{issue.title}</h4>

          {/* Card Meta */}
          <div className="card-meta">
            {/* Severity indicator */}
            <div 
              className="severity-indicator"
              style={{ backgroundColor: getSeverityColor(issue.severity) }}
              title={`Severity: ${issue.severity}`}
            />

            {/* Category */}
            <span className="category-badge" title={`Category: ${issue.category}`}>
              {getCategoryIcon(issue.category)}
            </span>

            {/* Assignee */}
            {issue.assignee && (
              <div className="assignee" title={`Assigned to ${issue.assignee.login}`}>
                {issue.assignee.avatar_url ? (
                  <img 
                    src={issue.assignee.avatar_url} 
                    alt={issue.assignee.login}
                    className="assignee-avatar"
                  />
                ) : (
                  <span className="assignee-initial">
                    {issue.assignee.login[0].toUpperCase()}
                  </span>
                )}
              </div>
            )}

            {/* Comments count */}
            {issue.comments > 0 && (
              <span className="comments-count" title={`${issue.comments} comments`}>
                💬 {issue.comments}
              </span>
            )}
          </div>

          {/* Labels */}
          {issue.labels.length > 0 && (
            <div className="card-labels">
              {issue.labels
                .filter(label => 
                  !label.name.startsWith('status:') && 
                  !label.name.startsWith('severity:') &&
                  !label.name.startsWith('category:')
                )
                .slice(0, 3)
                .map(label => (
                  <span 
                    key={label.id}
                    className="label"
                    style={{
                      backgroundColor: `#${label.color}20`,
                      color: `#${label.color}`,
                      borderColor: `#${label.color}40`
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              {issue.labels.length > 3 && (
                <span className="label label-more">+{issue.labels.length - 3}</span>
              )}
            </div>
          )}

          {/* Card Footer */}
          <div className="card-footer">
            <span className="created-date">
              {formatDate(issue.created_at)}
            </span>
            {issue.updated_at !== issue.created_at && (
              <span className="updated-indicator" title="Recently updated">
                ↻
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
});

IssueCard.displayName = 'IssueCard';

export default IssueCard;