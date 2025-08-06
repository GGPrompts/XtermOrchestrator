import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Navigation.module.css';

export default function Navigation() {
    const location = useLocation();
    
    return (
        <nav className={styles.navigation}>
            <div className={styles.navContainer}>
                <div className={styles.logo}>
                    🚀 AI Agent Launchpad
                </div>
                <div className={styles.navLinks}>
                    <Link 
                        to="/orchestrator" 
                        className={`${styles.navLink} ${location.pathname === '/orchestrator' ? styles.active : ''}`}
                    >
                        <span className={styles.icon}>🎯</span>
                        Orchestrator
                    </Link>
                    <Link 
                        to="/multi-terminal" 
                        className={`${styles.navLink} ${location.pathname === '/multi-terminal' ? styles.active : ''}`}
                    >
                        <span className={styles.icon}>🖥️</span>
                        Multi-Terminal
                    </Link>
                </div>
            </div>
        </nav>
    );
}