'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, verifyCertificate, type CertificateVerification } from '../../../lib/api';
import styles from '../verify.module.css';

export default function VerifyResultPage() {
  const { code } = useParams<{ code: string }>();
  const [result, setResult] = useState<CertificateVerification | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyCertificate(code)
      .then(({ data }) => setResult(data))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to verify certificate');
      });
  }, [code]);

  if (!result && !notFound && !error) {
    return (
      <main className={styles.wrap}>
        <p>Checking...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className={styles.wrap}>
        <h1 className={styles.title}>Verify a Certificate</h1>
        <p className={styles.invalid}>
          No certificate matches this verification code. Double-check the code and try again.
        </p>
        <Link href="/verify" className={styles.back}>
          ← Try another code
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.wrap}>
        <p className={styles.invalid}>{error}</p>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.certificate}>
        <div className={styles.badge}>✓ Verified Certificate</div>
        <div className={styles.studentName}>{result!.studentName}</div>
        <p>has successfully completed</p>
        <div className={styles.courseName}>{result!.courseTitle}</div>
        <div className={styles.certDetails}>
          <div>Certificate No. {result!.certificateNumber}</div>
          <div>Issued {new Date(result!.issuedAt).toLocaleDateString()}</div>
        </div>
      </div>
      <Link href="/verify" className={styles.back}>
        ← Verify another certificate
      </Link>
    </main>
  );
}
