'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCertificates, type Certificate } from '../../lib/api';
import { ensureAccessToken } from '../../lib/session';
import styles from './certificates.module.css';

export default function CertificatesPage() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<Certificate[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await ensureAccessToken();
        const res = await getCertificates(token);
        setCertificates(res.data);
      } catch {
        router.replace('/login');
      }
    }
    void load();
  }, [router]);

  if (!certificates) {
    return (
      <main className={styles.wrap}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Certificates</h1>
        <Link href="/dashboard">Back to dashboard</Link>
      </div>

      {certificates.length === 0 ? (
        <p className={styles.empty}>
          No certificates yet. Complete a course to earn one — <Link href="/courses">browse courses</Link>.
        </p>
      ) : (
        <div className={styles.list}>
          {certificates.map((cert) => (
            <Link key={cert.id} href={`/certificates/${cert.id}`} className={styles.card}>
              <div className={styles.courseTitle}>{cert.courseTitle}</div>
              <div className={styles.meta}>
                {cert.certificateNumber} — issued {new Date(cert.issuedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
