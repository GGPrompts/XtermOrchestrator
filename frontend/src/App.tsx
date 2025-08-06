import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './components/Navigation';
import styles from './App.module.css';

function App() {
  return (
    <div className={styles.app}>
      <Navigation />
      
      <main className={styles.main}>
        <section className={styles.heroSection}>
          <h1 className={styles.title}>🚀 AI Agent Launchpad</h1>
          <p className={styles.subtitle}>
            Unified orchestrator terminal system for managing AI agents
          </p>
          
          <div className={styles.launchOptions}>
            <Link to="/orchestrator" className={styles.primaryButton}>
              <span className={styles.buttonIcon}>🎯</span>
              <div>
                <h3>Launch Orchestrator</h3>
                <p>Unified magic terminal with AI agent coordination</p>
              </div>
            </Link>
          </div>
        </section>

        <section className={styles.featuresSection}>
          <h2>Key Features</h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <span className={styles.featureIcon}>🤖</span>
              <h3>Claude Code Integration</h3>
              <p>Built-in AI capabilities with full Docker MCP access</p>
            </div>
            <div className={styles.featureCard}>
              <span className={styles.featureIcon}>🎮</span>
              <h3>Dynamic Agent Control</h3>
              <p>Spawn and manage agents with simple commands</p>
            </div>
            <div className={styles.featureCard}>
              <span className={styles.featureIcon}>📊</span>
              <h3>Comprehensive Logging</h3>
              <p>Track all agent activity for analysis and debugging</p>
            </div>
            <div className={styles.featureCard}>
              <span className={styles.featureIcon}>🧠</span>
              <h3>Obsidian Integration</h3>
              <p>Knowledge management for AI context</p>
            </div>
          </div>
        </section>

        <section className={styles.quickStartSection}>
          <h2>Quick Start</h2>
          <div className={styles.codeBlock}>
            <div className={styles.step}>
              <h4>1. Start the system</h4>
              <code>docker-compose up -d</code>
            </div>
            
            <div className={styles.step}>
              <h4>2. Open Orchestrator</h4>
              <code>http://localhost:3000/orchestrator</code>
            </div>
            
            <div className={styles.step}>
              <h4>3. Authenticate Claude</h4>
              <code>claude auth</code>
            </div>
            
            <div className={styles.step}>
              <h4>4. Spawn your first agent</h4>
              <code>spawn developer</code>
            </div>
          </div>
        </section>

        <section className={styles.commandsSection}>
          <h2>Common Commands</h2>
          <div className={styles.commandGrid}>
            <div className={styles.commandCard}>
              <code>spawn &lt;name&gt;</code>
              <p>Create new agent terminal</p>
            </div>
            <div className={styles.commandCard}>
              <code>status</code>
              <p>Show active agents</p>
            </div>
            <div className={styles.commandCard}>
              <code>send &lt;agent&gt; &lt;msg&gt;</code>
              <p>Send to specific agent</p>
            </div>
            <div className={styles.commandCard}>
              <code>broadcast &lt;msg&gt;</code>
              <p>Send to all agents</p>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          AI Agent Launchpad - Orchestrating AI agents with ease
        </p>
        <div className={styles.footerLinks}>
          <a href="https://github.com/GGPrompts/AI-Agent-Launchpad" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span>•</span>
          <a href="/orchestrator">
            Orchestrator
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;