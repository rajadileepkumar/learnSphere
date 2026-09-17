import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Learn what matters. Build skills. Practice. Get better.</h1>
      <div className={styles.ctas}>
        <Link className={styles.primary} href="/register">
          Get started
        </Link>
        <Link className={styles.secondary} href="/login">
          Log in
        </Link>
      </div>
    </div>
  );
}
