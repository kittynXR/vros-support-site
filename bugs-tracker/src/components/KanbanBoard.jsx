import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from './KanbanColumn';
import githubAPI from '../api/github';
import '../styles/kanban.css';

/**
 * KanbanBoard Component - Main Kanban board with drag-and-drop
 */
const KanbanBoard = () => {
  // State
  const [issues, setIssues] = useState({
    backlog: [],
    todo: [],
    inProgress: [],
    testing: [],
    done: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    category: 'all',
    assignee: 'all',
    search: ''
  });
  const [isFiltered, setIsFiltered] = useState(false);
  const [stats, setStats] = useState(null);

  // Column order
  const columns = ['backlog', 'todo', 'inProgress', 'testing', 'done'];

  // Load issues on mount
  useEffect(() => {
    loadIssues();
    loadStats();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadIssues();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Load issues from GitHub
  const loadIssues = async () => {
    try {
      setError(null);
      const data = await githubAPI.getIssues();
      setIssues(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const data = await githubAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Handle drag end
  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Dropped outside the list
    if (!destination) return;

    // No movement
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Get the issue being moved
    const sourceColumn = issues[source.droppableId];
    const movedIssue = sourceColumn.find(issue => issue.id === draggableId);

    if (!movedIssue) return;

    // Optimistically update UI
    const newIssues = { ...issues };
    
    // Remove from source
    newIssues[source.droppableId] = sourceColumn.filter(
      issue => issue.id !== draggableId
    );
    
    // Add to destination
    const destColumn = [...newIssues[destination.droppableId]];
    destColumn.splice(destination.index, 0, movedIssue);
    newIssues[destination.droppableId] = destColumn;
    
    setIssues(newIssues);

    // Update GitHub labels if moving to different column
    if (source.droppableId !== destination.droppableId) {
      try {
        // Map column ID to status label
        const statusMap = {
          backlog: 'backlog',
          todo: 'todo',
          inProgress: 'in-progress',
          testing: 'testing',
          done: 'done'
        };

        await githubAPI.updateIssueLabels(
          movedIssue.number,
          statusMap[destination.droppableId]
        );

        // If moved to done, close the issue
        if (destination.droppableId === 'done' && movedIssue.state !== 'closed') {
          // Note: Closing issues would require additional API endpoint
          console.log('Issue moved to done - consider closing');
        }
      } catch (err) {
        // Revert on error
        setIssues(issues);
        setError(`Failed to update issue: ${err.message}`);
      }
    }
  };

  // Handle filter change
  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    
    // Check if any filters are active
    const hasActiveFilters = 
      newFilters.severity !== 'all' ||
      newFilters.category !== 'all' ||
      newFilters.assignee !== 'all' ||
      newFilters.search !== '';
    
    setIsFiltered(hasActiveFilters);
  };

  // Apply filters to issues
  const getFilteredIssues = useCallback(() => {
    if (!isFiltered) return issues;

    let filtered = { ...issues };

    // Apply search
    if (filters.search) {
      filtered = githubAPI.searchIssues(filtered, filters.search);
    }

    // Apply other filters
    if (filters.severity !== 'all' || filters.category !== 'all' || filters.assignee !== 'all') {
      filtered = githubAPI.filterIssues(filtered, filters);
    }

    return filtered;
  }, [issues, filters, isFiltered]);

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      severity: 'all',
      category: 'all',
      assignee: 'all',
      search: ''
    });
    setIsFiltered(false);
  };

  // Get filtered issues
  const displayIssues = getFilteredIssues();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <span>Loading issues...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2 className="error-title">Failed to load issues</h2>
        <p className="error-message">{error}</p>
        <button className="retry-btn" onClick={loadIssues}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="kanban-container">
      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          {/* Search */}
          <div className="filter-item">
            <input
              type="text"
              className="search-input"
              placeholder="Search issues..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>

          {/* Severity Filter */}
          <div className="filter-item">
            <select
              className="filter-select"
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="filter-item">
            <select
              className="filter-select"
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="vr">VR/Headset</option>
              <option value="overlay">Overlay</option>
              <option value="performance">Performance</option>
              <option value="ui">UI/UX</option>
              <option value="audio">Audio</option>
              <option value="input">Input</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Clear Filters */}
          {isFiltered && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-group">
            <span className="stat-item">
              <span className="stat-label">Open:</span>
              <span className="stat-value">{stats.openIssues}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">Closed:</span>
              <span className="stat-value">{stats.closedIssues}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">Avg Resolution:</span>
              <span className="stat-value">{stats.avgResolutionTime}</span>
            </span>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-board">
          {columns.map(column => (
            <KanbanColumn
              key={column}
              column={column}
              issues={displayIssues[column] || []}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Refresh Indicator */}
      <div className="refresh-indicator">
        <span className="refresh-text">Auto-refresh in 30s</span>
        <button className="refresh-btn" onClick={loadIssues} title="Refresh now">
          ↻
        </button>
      </div>
    </div>
  );
};

export default KanbanBoard;