import React from 'react';

interface SageLogoProps {
  variant?: 'sidebar' | 'large' | 'icon';
  className?: string;
}

export default function SageLogo({
  variant = 'large',
  className = '',
}: SageLogoProps) {
  const isSidebar = variant === 'sidebar';
  const isIcon = variant === 'icon';
  const starSize = isSidebar ? 24 : isIcon ? '100%' : 72;

  // SVG Star Icon Component
  const StarIcon = (
    <svg
      viewBox="0 0 100 100"
      width={starSize}
      height={starSize}
      className="sage-logo-star"
      style={{
        display: 'block',
        filter: isSidebar 
          ? 'drop-shadow(0 2px 6px rgba(6, 182, 212, 0.25))' 
          : 'drop-shadow(0 8px 24px rgba(6, 182, 212, 0.35))',
        animation: 'sage-logo-pulse 4s ease-in-out infinite alternate',
        flexShrink: 0,
      }}
    >
      <defs>
        <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" /> {/* Cyan */}
          <stop offset="50%" stopColor="#3b82f6" /> {/* Blue */}
          <stop offset="100%" stopColor="#a855f7" /> {/* Purple */}
        </linearGradient>
        <radialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
          <stop offset="40%" stopColor="#22d3ee" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="starHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
          <stop offset="70%" stopColor="#a855f7" stopOpacity={0.08} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Background Soft Glow Orb (only for large) */}
      {!isSidebar && <circle cx="50" cy="50" r="45" fill="url(#starHalo)" />}
      
      {/* Outer Glow Layer */}
      <path
        d="M 50 10 Q 50 50 90 50 Q 50 50 50 90 Q 50 50 10 50 Q 50 50 50 10 Z"
        fill="url(#starGrad)"
        opacity="0.35"
        style={{ transformOrigin: 'center', transform: 'scale(1.08)', filter: 'blur(3px)' }}
      />
      {/* Main Star */}
      <path
        d="M 50 12 Q 50 50 88 50 Q 50 50 50 88 Q 50 50 12 50 Q 50 50 50 12 Z"
        fill="url(#starGrad)"
      />
      {/* Inner Highlight for 3D depth */}
      <path
        d="M 50 22 Q 50 50 78 50 Q 50 50 50 78 Q 50 50 22 50 Q 50 50 50 22 Z"
        fill="url(#innerGlow)"
      />
      {/* Central Flare Core */}
      <circle cx="50" cy="50" r="3.5" fill="#ffffff" style={{ filter: 'drop-shadow(0 0 3px #fff)' }} />
    </svg>
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
          <p 
            className="sage-logo-subtitle" 
            style={{ 
              fontSize: '0.75rem',
              maxWidth: '300px'
            }}
          >
            Smart Analytics <span style={{ color: 'var(--accent-primary, #3b82f6)', fontWeight: 600 }}>&</span> Generative Engine
          </p>
        )}
      </div>
    </div>
  );
}
