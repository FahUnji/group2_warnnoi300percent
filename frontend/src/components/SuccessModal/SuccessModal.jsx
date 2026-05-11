import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SuccessModal.module.css';

/**
 * D-10: Shows briefly after successful connection, then auto-redirects to /dashboard.
 * Auto-redirect after 2000ms. "Go to Dashboard" navigates immediately.
 */
function SuccessModal() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  function handleGoNow() {
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={styles.modal}>
        {/* Animated icon */}
        <div className={styles.iconWrap}>
          <div className={styles.iconCircle}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path
                className={styles.checkPath}
                d="M7 14l5 5 9-9"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <h2 className={styles.title} id="modal-title">
          Jira Connection Successful
        </h2>
        <p className={styles.desc}>
          Your Jira workspace is connected and ready for reporting.
        </p>
        <p className={styles.redirect}>Redirecting to dashboard…</p>
        <button className={styles.btn} onClick={handleGoNow}>
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

export default SuccessModal;
