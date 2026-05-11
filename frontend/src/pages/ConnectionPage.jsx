import ConnectionForm from '../components/ConnectionForm/ConnectionForm';
import styles from './ConnectionPage.module.css';

function ConnectionPage({ initialError, apiBase }) {
  return (
    <div className={styles.pageWrapper}>
      <main className={styles.heroGrid}>
        {/* Hero left — hidden on mobile per UI-SPEC responsive breakpoint */}
        <div className={styles.heroLeft}>
          <p className={styles.tagline}>BRIDGE · ANALYZE · RESOLVE</p>
          <h1 className={styles.heroHeading}>
            Where Software Tester<br />meets insight.
          </h1>
          <p className={styles.heroSubtext}>
            Connect your Jira workspace and get instant visibility<br />
            into bug health across all your projects.
          </p>
        </div>
        {/* Login card — right column */}
        <div className={styles.loginCardCol}>
          <ConnectionForm initialError={initialError} apiBase={apiBase} />
        </div>
      </main>
      <footer className={styles.footer}>
        <span className={styles.footerCopy}>
          © 2024 JIRA Bug Summary Enterprise. All rights reserved.
        </span>
        <nav className={styles.footerLinks}>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Security</a>
          <a href="#">Status</a>
        </nav>
      </footer>
    </div>
  );
}

export default ConnectionPage;
