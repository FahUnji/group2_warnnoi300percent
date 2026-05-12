import styles from './StatusBanner.module.css';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

/**
 * Inline status banner with three variants: loading | success | error
 * Props:
 *   variant: 'loading' | 'success' | 'error'
 *   message: string
 */
function StatusBanner({ variant, message }) {
  return (
    <div
      className={`${styles.banner} ${styles[variant]}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      {variant === 'loading' && <LoadingSpinner size={16} />}
      {variant === 'error' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="#b91c1c" strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="12" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1" fill="#b91c1c" />
        </svg>
      )}
      {variant === 'success' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="#1b4332" strokeWidth="2" />
          <path d="M8 12l3 3 5-5" stroke="#1b4332" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span>{message}</span>
    </div>
  );
}

export default StatusBanner;
