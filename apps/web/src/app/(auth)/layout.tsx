import type { ReactNode } from 'react';
import styles from './auth.module.css';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.hero}>
        <div className={styles.heroBrand}>LearnSphere</div>
        <h1 className={styles.heroTitle}>Continue where you left off.</h1>
        <p className={styles.heroSubtitle}>Your courses, progress and certificates are waiting.</p>
      </div>
      <div className={styles.panel}>{children}</div>
    </div>
  );
}
