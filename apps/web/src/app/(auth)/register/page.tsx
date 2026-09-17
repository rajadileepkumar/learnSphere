'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { register } from '../../../lib/api';
import { setAccessToken } from '../../../lib/session';
import formStyles from '../form.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await register({ email, password, displayName });
      setAccessToken(data.accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={formStyles.form} onSubmit={onSubmit}>
      <h1 className={formStyles.title}>Create an account</h1>
      {error && <p className={formStyles.error}>{error}</p>}
      <label className={formStyles.label} htmlFor="displayName">
        Name
      </label>
      <input
        id="displayName"
        type="text"
        className={formStyles.input}
        placeholder="Ada Lovelace"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />
      <label className={formStyles.label} htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        className={formStyles.input}
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <label className={formStyles.label} htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        className={formStyles.input}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />
      <button className={formStyles.submit} type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <p className={formStyles.footer}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}
