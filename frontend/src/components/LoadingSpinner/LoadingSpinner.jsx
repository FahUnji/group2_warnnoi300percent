import styles from './LoadingSpinner.module.css';

function LoadingSpinner({ size = 20 }) {
  return (
    <div
      className={styles.spinner}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export default LoadingSpinner;
