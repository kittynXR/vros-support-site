import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import IssueCard from './IssueCard';
import '../styles/kanban.css';

/**
 * KanbanColumn Component - Represents a column in the Kanban board
 */
const KanbanColumn = ({ column, issues = [] }) => {
  // Column configurations
  const columnConfig = {
    backlog: {
      title: 'Backlog',
      color: 'var(--status-backlog)',
      icon: '📝',
      description: 'New and unplanned issues'
    },
    todo: {
      title: 'To Do',
      color: 'var(--status-todo)',
      icon: '📋',
      description: 'Planned for development'
    },
    inProgress: {
      title: 'In Progress',
      color: 'var(--status-progress)',
      icon: '🚀',
      description: 'Currently being worked on'
    },
    testing: {
      title: 'Testing',
      color: 'var(--status-testing)',
      icon: '🧪',
      description: 'Under review or testing'
    },
    done: {
      title: 'Done',
      color: 'var(--status-done)',
      icon: '✅',
      description: 'Completed and closed'
    }
  };

  const config = columnConfig[column] || columnConfig.backlog;

  return (
    <div className="kanban-column" style={{ '--column-color': config.color }}>
      {/* Column Header */}
      <div className="column-header">
        <div className="column-title">
          <span className="column-icon">{config.icon}</span>
          <h3>{config.title}</h3>
          <span className="issue-count">{issues.length}</span>
        </div>
        <div className="column-description">{config.description}</div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={column}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`column-content ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
          >
            {/* Issue Cards */}
            {issues.length > 0 ? (
              issues.map((issue, index) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  index={index}
                />
              ))
            ) : (
              <div className="empty-column">
                <p>No issues</p>
                <span>Drag issues here</span>
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Column Footer */}
      <div className="column-footer">
        {column === 'backlog' && (
          <button className="add-issue-btn" title="Create new issue">
            + New Issue
          </button>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;