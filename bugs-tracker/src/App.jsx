import { useState } from 'react'
import KanbanBoard from './components/KanbanBoard'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState('kanban')

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <h1 className="header-title">VROS Bug Tracker</h1>
          </div>
          <nav className="header-nav">
            <a 
              href="https://support.vros.cat" 
              className="nav-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              Support Home
            </a>
            <a 
              href="https://support.vros.cat/report-bug" 
              className="nav-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              + Report Bug
            </a>
          </nav>
        </div>
      </header>

      {/* View Tabs */}
      <div className="view-tabs">
        <button 
          className={`tab-btn ${activeView === 'kanban' ? 'active' : ''}`}
          onClick={() => setActiveView('kanban')}
        >
          📋 Kanban Board
        </button>
        <button 
          className={`tab-btn ${activeView === 'list' ? 'active' : ''}`}
          onClick={() => setActiveView('list')}
        >
          📝 List View
        </button>
        <button 
          className={`tab-btn ${activeView === 'sprint' ? 'active' : ''}`}
          onClick={() => setActiveView('sprint')}
        >
          🏃 Sprint View
        </button>
      </div>

      {/* Main Content */}
      <main className="main-content">
        {activeView === 'kanban' && <KanbanBoard />}
        {activeView === 'list' && (
          <div className="coming-soon">
            <h2>List View</h2>
            <p>Coming soon - Table view of all issues</p>
          </div>
        )}
        {activeView === 'sprint' && (
          <div className="coming-soon">
            <h2>Sprint Planning</h2>
            <p>Coming soon - Sprint planning and burndown charts</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
