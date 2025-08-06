import React from 'react'
import styles from './ExampleComponent.module.css'

interface ExampleComponentProps {
  count: number
  onCountChange: (count: number) => void
}

export default function ExampleComponent({ count, onCountChange }: ExampleComponentProps) {
  return (
    <div className={styles.example}>
      <div className={styles.card}>
        <h3>Interactive Example</h3>
        <p>This is an example component to demonstrate the template structure.</p>
        
        <div className={styles.counter}>
          <button 
            onClick={() => onCountChange(count - 1)}
            className={styles.button}
          >
            -
          </button>
          
          <span className={styles.count}>
            Count: {count}
          </span>
          
          <button 
            onClick={() => onCountChange(count + 1)}
            className={styles.button}
          >
            +
          </button>
        </div>
        
        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.icon}>[FAST]</span>
            <span>Fast Development</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.icon}>🎨</span>
            <span>Portfolio Styled</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.icon}>[CONFIG]</span>
            <span>TypeScript Ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}