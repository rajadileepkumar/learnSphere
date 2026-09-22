'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout, me, type AuthUser } from '../lib/api';
import { clearAccessToken, ensureAccessToken } from '../lib/session';
import styles from './NavBar.module.css';

const LINKS = [
  ['/dashboard', 'Dashboard'],
  ['/courses', 'Courses'],
  ['/ai', 'AI Tutor'],
  ['/notes', 'Notes'],
  ['/bookmarks', 'Bookmarks'],
] as const;

// Certificates are earned by taking courses, so the link only makes sense for roles that do —
// platform admins manage the catalog from /admin instead of completing lessons themselves.
const CERTIFICATE_ROLES = ['STUDENT', 'INSTRUCTOR'];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    ensureAccessToken()
      .then((t) => me(t))
      .then((r) => setUser(r.data.user))
      .catch(() => setUser(null));
  }, [pathname]);

  // Login/register pages have their own layout; the landing page is the entry point.
  if (pathname === '/' || pathname === '/login' || pathname === '/register') return null;

  async function onLogout() {
    await logout().catch(() => {});
    clearAccessToken();
    setUser(null);
    router.push('/login');
  }

  const links = [
    ...LINKS,
    ...(user && CERTIFICATE_ROLES.includes(user.role) ? [['/certificates', 'Certificates'] as const] : []),
    ...(user?.role === 'PLATFORM_ADMIN' ? [['/admin', 'Admin'] as const] : []),
  ];

  return (
    <nav className={styles.nav}>
      <Link href="/dashboard" className={styles.brand}>
        LearnSphere
      </Link>
      {user && (
        <>
          <div className={styles.links}>
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={pathname === href || pathname.startsWith(href + '/') ? styles.active : undefined}
              >
                {label}
              </Link>
            ))}
          </div>
          <button className={styles.logout} onClick={onLogout}>
            Log out
          </button>
        </>
      )}
      {!user && (
        <Link href="/login" className={styles.logout}>
          Log in
        </Link>
      )}
    </nav>
  );
}
