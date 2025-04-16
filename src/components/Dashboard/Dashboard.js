// src/components/Dashboard/Dashboard.js
import React, { useState, useEffect } from 'react';
import { QueenAgent, ScoutAgent, ForagerAgent } from '../../agents';
import Colony from '../Colony/Colony';
import KnowledgeGraph from '../KnowledgeGraph/KnowledgeGraph';
import Controls from '../Controls/Controls';
import PaperManagement from '../PaperManagement/PaperManagement';
import StorageService from '../../services/StorageService';
import './Dashboard.css';

const Dashboard = () => {
  const [colony, setColony] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState({});
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [activeTab, setActiveTab] = useState('colony');
  const [preferences, setPreferences] = useState(null);
  const [simulationInterval, setSimulationIntervalId] = useState(null);

  // Load preferences and initialize colony
  useEffect(() => {
    const prefs = StorageService.loadPreferences();
    setPreferences(prefs);

    if (prefs) {
      setSimulationSpeed(prefs.simulationSpeed || 1);
    }

    initializeColony();

    // Clean up on unmount
    return () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
      }
    };
  }, []);

  // Save preferences when they change
  useEffect(() => {
    if (preferences) {
      StorageService.savePreferences(preferences);
    }
  }, [preferences]);

  const initializeColony = () => {
    // Try to load saved colony state
    const savedState = StorageService.loadColonyState();

    // Create queen agent
    const queen = new QueenAgent('queen_1', 'Queen Bee');

    // Create scout agents
    for (let i = 0; i < 5; i++) {
      new ScoutAgent(`scout_${i + 1}`, `Scout ${i + 1}`, queen);
    }

    // Create forager agents
    for (let i = 0; i < 8; i++) {
      new ForagerAgent(`forager_${i + 1}`, `Forager ${i + 1}`, queen);
    }

    // If we have saved state, restore it
    if (savedState) {
      try {
        // Restore metrics
        queen.globalKnowledgeBase.metrics = savedState.metrics || {
          papersProcessed: 0,
          knowledgeExtracted: 0,
          novelConnections: 0
        };

        // Restore papers
        if (savedState.papers) {
          queen.globalKnowledgeBase.papers = new Map(savedState.papers);
        }

        // Restore entities
        if (savedState.entities) {
          queen.globalKnowledgeBase.entities = new Map(savedState.entities);
        }

        // Restore relationships
        if (savedState.relationships) {
          queen.globalKnowledgeBase.relationships = new Map(savedState.relationships);
        }

        console.log('Restored colony state from storage');
      } catch (error) {
        console.error('Error restoring colony state:', error);
      }
    }

    setColony(queen);
  };

  const startSimulation = () => {
    if (isRunning) return;

    setIsRunning(true);

    // Start simulation loop
    const interval = setInterval(() => {
      if (colony) {
        // Assign tasks
        colony.assignTasks();

        // Update priorities
        colony.addTask({
          type: 'update_priorities'
        });

        // Process tasks
        colony.processTask({
          type: 'evaluate_reports',
          reports: [] // In a real implementation, this would have actual reports
        });

        // Save colony state if auto-save is enabled
        if (preferences && preferences.autoSave) {
          StorageService.saveColonyState(colony);
        }
      }
    }, 2000 / simulationSpeed); // Adjust speed based on simulationSpeed

    setSimulationIntervalId(interval);
  };

  const stopSimulation = () => {
    if (!isRunning) return;

    setIsRunning(false);

    if (simulationInterval) {
      clearInterval(simulationInterval);
      setSimulationIntervalId(null);
    }

    // Save colony state when stopping
    if (colony) {
      StorageService.saveColonyState(colony);
    }
  };

  const handleStatusUpdate = (newStatus) => {
    setStatus(newStatus);
  };

  const handleSpeedChange = (speed) => {
    setSimulationSpeed(speed);

    // Update preferences
    setPreferences(prev => ({
      ...prev,
      simulationSpeed: speed
    }));

    // Restart simulation with new speed if it's running
    if (isRunning) {
      stopSimulation();
      startSimulation();
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleTogglePreference = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'colony':
        return (
          <div className="dashboard-content">
            <div className="dashboard-column">
              {colony && (
                <Colony
                  queen={colony}
                  onStatusUpdate={handleStatusUpdate}
                  visualizeAgents={preferences?.visualizeAgents}
                />
              )}
            </div>

            <div className="dashboard-column">
              {colony && preferences?.showKnowledgeGraph && (
                <KnowledgeGraph queen={colony} />
              )}
            </div>
          </div>
        );

      case 'papers':
        return (
          <div className="dashboard-papers">
            {colony && (
              <PaperManagement queen={colony} />
            )}
          </div>
        );

      case 'settings':
        return (
          <div className="dashboard-settings">
            <div className="settings-card">
              <h3>Simulation Settings</h3>
              <div className="settings-group">
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences?.visualizeAgents}
                      onChange={() => handleTogglePreference('visualizeAgents')}
                    />
                    Visualize Agent Movement
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences?.showKnowledgeGraph}
                      onChange={() => handleTogglePreference('showKnowledgeGraph')}
                    />
                    Show Knowledge Graph
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences?.darkMode}
                      onChange={() => handleTogglePreference('darkMode')}
                    />
                    Dark Mode
                  </label>
                </div>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences?.autoSave}
                      onChange={() => handleTogglePreference('autoSave')}
                    />
                    Auto-Save Colony State
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-card">
              <h3>LLM Settings</h3>
              <div className="settings-group">
                <div className="setting-item">
                  <label>LLM Provider:</label>
                  <select className="setting-select">
                    <option value="browser">In-Browser (Faster)</option>
                    <option value="local">Local API (More Powerful)</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>
                    <input type="checkbox" checked={true} />
                    Cache Analysis Results
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-card">
              <h3>System Management</h3>
              <div className="settings-actions">
                <button className="setting-button">Reset Colony</button>
                <button className="setting-button">Export Knowledge Graph</button>
                <button className="setting-button danger">Clear All Data</button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="dashboard-content">
            <p>Select a tab to view content</p>
          </div>
        );
    }
  };

  return (
    <div className={`dashboard-container ${preferences?.darkMode ? 'dark-mode' : ''}`}>
      <header className="dashboard-header">
        <h1>Biomedical Literature Analysis: Bee-Inspired Multi-Agent System</h1>
      </header>

      <div className="dashboard-navigation">
        <div className="dashboard-tabs">
          <div
            className={`tab ${activeTab === 'colony' ? 'active' : ''}`}
            onClick={() => handleTabChange('colony')}
          >
            Colony Visualization
          </div>
          <div
            className={`tab ${activeTab === 'papers' ? 'active' : ''}`}
            onClick={() => handleTabChange('papers')}
          >
            Paper Management
          </div>
          <div
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            Settings
          </div>
        </div>

        <div className="dashboard-controls">
          <Controls
            isRunning={isRunning}
            onStart={startSimulation}
            onStop={stopSimulation}
            speed={simulationSpeed}
            onSpeedChange={handleSpeedChange}
          />
        </div>
      </div>

      {renderTabContent()}

      <div className="dashboard-metrics">
        <h2>Colony Metrics</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Papers Processed</h3>
            <div className="metric-value">{status.metrics?.papersProcessed || 0}</div>
          </div>
          <div className="metric-card">
            <h3>Knowledge Items</h3>
            <div className="metric-value">{status.metrics?.knowledgeExtracted || 0}</div>
          </div>
          <div className="metric-card">
            <h3>Scout Agents</h3>
            <div className="metric-value">{status.scouts?.length || 0}</div>
          </div>
          <div className="metric-card">
            <h3>Forager Agents</h3>
            <div className="metric-value">{status.foragers?.length || 0}</div>
          </div>
        </div>
      </div>

      <footer className="dashboard-footer">
        <p>Biomedical Literature Analysis System - Bee Colony Inspired</p>
      </footer>
    </div>
  );
};

export default Dashboard;
