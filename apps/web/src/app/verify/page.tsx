'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import styles from './verify.module.css';

export default function VerifyEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/verify/${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Verify a Certificate</h1>
      <p className={styles.meta}>Enter the verification code printed on a LearnSphere certificate.</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <input
          className={styles.input}
          placeholder="Verification code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className={styles.submitButton} type="submit" disabled={!code.trim()}>
          Verify
        </button>
      </form>
    </main>
  );
}
