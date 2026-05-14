import { useState, useEffect, useRef } from 'react';
import styles from './Navbar.module.css';

export default function Navbar({ user, onLogout, onMenuToggle, menuOpen, onLogoClick }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleLogoClick(e) {
    if (onLogoClick) {
      e.preventDefault();
      onLogoClick();
    }
  }

  return (
    <header className={`${styles.topnav} ${onMenuToggle ? styles.hasSidebar : ''}`}>

      {/* Left: hamburger (sidebar pages) */}
      <div className={styles.navLeft}>
        {onMenuToggle && (
          <button
            className={styles.menuBtn}
            onClick={onMenuToggle}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" stroke="#065b41" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="12" x2="21" y2="12" stroke="#065b41" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="18" x2="21" y2="18" stroke="#065b41" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Center: logo + brand */}
      <div className={styles.navCenter}>
        <a href="/dashboard" className={styles.logoLink} onClick={handleLogoClick} aria-label="Go to Dashboard">
          <div className={styles.logo}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M13 2L4.09347 12.6879C3.74465 13.1064 3.57024 13.3157 3.56709 13.4925C3.56434 13.6461 3.63257 13.7923 3.75168 13.8889C3.88863 14 4.15924 14 4.70046 14H12L11 22L19.9065 11.3121C20.2554 10.8936 20.4298 10.6843 20.4329 10.5075C20.4357 10.3539 20.3674 10.2077 20.2483 10.1111C20.1114 10 19.8408 10 19.2995 10H12L13 2Z"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
        </a>
        <span className={styles.brand}>JIRA Bug Summary</span>
      </div>

      {/* Right: user menu */}
      <div className={styles.navRight}>
        <div className={styles.userWrap} ref={menuRef}>
          <button
            className={styles.userBtn}
            aria-label="User menu"
            aria-haspopup="true"
            aria-expanded={showMenu}
            onClick={() => setShowMenu(v => !v)}
          >
            <div className={styles.avatar}>
              {user?.avatar ? (
                <img src={user.avatar} alt="" width={24} height={24} style={{ borderRadius: '50%' }} />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#065b41" strokeWidth="2"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#065b41" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <span className={styles.username}>{user?.name || 'Account'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
              <path d="M1 1L5 5L9 1" stroke="#065b41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {showMenu && (
            <div className={styles.dropdown} role="menu">
              {user?.name && (
                <div className={styles.dropdownHeader}>
                  <span className={styles.dropdownName}>{user.name}</span>
                  {user.email && <span className={styles.dropdownEmail}>{user.email}</span>}
                </div>
              )}
              <button className={styles.logoutItem} role="menuitem" onClick={onLogout}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="16 17 21 12 16 7" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="21" y1="12" x2="9" y2="12" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
