import React from 'react';

interface SageLogoProps {
  variant?: 'sidebar' | 'large' | 'icon';
  className?: string;
  isThinking?: boolean;
}

export default function SageLogo({
  variant = 'large',
  className = '',
  isThinking = false,
}: SageLogoProps) {
  const isSidebar = variant === 'sidebar';
  const isIcon = variant === 'icon';
  const starSize = isSidebar ? 24 : isIcon ? '100%' : 72;

  // SAGE Icon Component with Dynamic Thinking State
  const StarIcon = (
    <div
      style={{
        position: 'relative',
        width: typeof starSize === 'number' ? `${starSize}px` : starSize,
        height: typeof starSize === 'number' ? `${starSize}px` : starSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src="/icon.png"
        alt="SAGE Logo"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: isThinking
            ? 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.8))'
            : isSidebar 
            ? 'drop-shadow(0 2px 6px rgba(6, 182, 212, 0.25))' 
            : 'drop-shadow(0 8px 24px rgba(6, 182, 212, 0.35))',
          animation: isThinking
            ? 'sage-logo-rotate-pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite'
            : 'sage-logo-pulse 4s ease-in-out infinite alternate',
          flexShrink: 0,
        }}
      />
    </div>
  );

  if (isIcon) {
    return StarIcon;
  }

  return (
    <div
      className={`sage-logo-container ${isSidebar ? 'layout-sidebar' : 'layout-large'} ${className}`}
      style={{
        display: 'flex',
        flexDirection: isSidebar ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isSidebar ? '0.625rem' : '1.25rem',
        textAlign: 'center',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sage-logo-pulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
        @keyframes sage-logo-rotate-pulse {
          0% { transform: scale(0.95) rotate(0deg); }
          50% { transform: scale(1.08) rotate(180deg); }
          100% { transform: scale(0.95) rotate(360deg); }
        }
        .sage-logo-title-wrap {
          display: inline-flex;
          align-items: center;
          font-family: var(--font-sans), 'Outfit', -apple-system, sans-serif;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          line-height: 1;
        }
        .sage-logo-letter-a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .sage-logo-subtitle {
          font-family: var(--font-sans), 'Outfit', -apple-system, sans-serif;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-top: 0.5rem;
          color: var(--text-secondary);
          opacity: 0.85;
          line-height: 1.4;
        }
      `}} />
      
      {StarIcon}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isSidebar ? 'flex-start' : 'center' }}>
        <div 
          className="sage-logo-title-wrap"
          style={{
            fontSize: isSidebar ? '1.15rem' : '2.25rem',
            letterSpacing: isSidebar ? '0.08em' : '0.12em',
            gap: isSidebar ? '1px' : '3px',
          }}
        >
          <span>S</span>
          <span className="sage-logo-letter-a" style={{ width: isSidebar ? '14px' : '28px', height: isSidebar ? '16px' : '32px' }}>
            <svg viewBox="0 0 24 30" width="100%" height="100%">
              <path 
                d="M 4 26 L 12 4 L 20 26" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth={isSidebar ? "3.2" : "2.8"} 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              <circle 
                cx="12" 
                cy="17" 
                r={isSidebar ? "3.2" : "2.8"} 
                fill="var(--accent-secondary, #06b6d4)" 
              />
            </svg>
          </span>
          <span>G</span>
          <span>E</span>
        </div>

        {!isSidebar && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}>
            <p 
              className="sage-logo-subtitle" 
              style={{ 
                fontSize: '0.85rem',
                maxWidth: '320px',
                textTransform: 'none',
                letterSpacing: '0.04em',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginTop: '0.5rem'
              }}
            >
              <span>Smart </span>
              <span style={{ color: 'var(--accent-primary, #3b82f6)' }}>Analytics</span>
              <span style={{ color: 'var(--text-muted)' }}> & </span>
              <span style={{ color: '#a855f7' }}>Generative</span>
              <span> Engine</span>
            </p>
            <p
              style={{
                fontSize: '0.8rem',
                lineHeight: '1.5',
                color: 'var(--text-muted)',
                maxWidth: '340px',
                fontWeight: 300,
                textAlign: 'center',
                margin: '0.25rem 0 0.5rem 0'
              }}
            >
              SAGE is an intelligent AI workspace that combines the power of analytics and generative intelligence to help teams explore, analyze and create with confidence.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

