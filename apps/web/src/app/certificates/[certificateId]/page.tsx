'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCertificate, me, type AuthUser, type Certificate } from '../../../lib/api';
import { ensureAccessToken } from '../../../lib/session';
import styles from '../certificates.module.css';

export default function CertificateDetailPage() {
  const router = useRouter();
  const params = useParams<{ certificateId: string }>();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await ensureAccessToken();
        const [certRes, meRes] = await Promise.all([getCertificate(params.certificateId, token), me(token)]);
        setCertificate(certRes.data);
        setUser(meRes.data.user);
      } catch {
        router.replace('/login');
      }
    }
    void load();
  }, [router, params.certificateId]);

  if (!certificate || !user) {
    return (
      <main className={styles.certificateWrap}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className={styles.certificateWrap}>
      <div className={styles.certificate}>
        <div className={styles.badge}>Certificate of Completion</div>
        <div className={styles.studentName}>{user.displayName}</div>
        <p>has successfully completed</p>
        <div className={styles.courseName}>{certificate.courseTitle}</div>
        <div className={styles.certDetails}>
          <div>Certificate No. {certificate.certificateNumber}</div>
          <div>Issued {new Date(certificate.issuedAt).toLocaleDateString()}</div>
          <div>
            Verify at:{' '}
            <Link href={`/verify/${certificate.verificationCode}`}>/verify/{certificate.verificationCode}</Link>
          </div>
        </div>
      </div>
      <Link href="/certificates" className={styles.back}>
        Back to certificates
      </Link>
    </main>
  );
}
