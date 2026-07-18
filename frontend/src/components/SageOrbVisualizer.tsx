import React from "react";
import styles from "./SageOrbVisualizer.module.css";
import SageLogo from "./SageLogo";

export type OrbState = "idle" | "listening" | "thinking" | "responding" | "completed";

interface SageOrbVisualizerProps {
  state: OrbState;
  size?: number;
  showLabel?: boolean;
}

export const SageOrbVisualizer: React.FC<SageOrbVisualizerProps> = ({
  state,
  size = 120,
  showLabel = true,
}) => {
  // Label text matching states
  const labels: Record<OrbState, string> = {
    idle: "SAGE is active",
    listening: "Listening...",
    thinking: "Thinking...",
    responding: "Responding...",
    completed: "Analysis Completed",
  };

  // State-specific classes
  const stateClass = styles[`state_${state}`] || "";

  return (
    <div className={`${styles.container} ${stateClass}`}>
      <div 
        className={styles.orbWrapper} 
        style={{ 
          width: `${size}px`, 
          height: `${size}px` 
        }}
      >
        {/* State: Listening Rings */}
        {state === "listening" && (
          <>
            <div className={styles.rippleRing}></div>
            <div className={styles.rippleRing2}></div>
          </>
        )}

        {/* State: Thinking Orbit particles */}
        {state === "thinking" && <div className={styles.particleOrbit}></div>}

        {/* Main Logo Orb */}
        <div
          className={styles.orbImage}
          style={{
            width: `${size * 0.75}px`,
            height: `${size * 0.75}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SageLogo variant="icon" />
        </div>
      </div>

      {/* Visualizers (bars / dots) below the orb */}
      {showLabel && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          {/* Label */}
          <span className={styles.statusLabel}>{labels[state]}</span>

          {/* Helper visual element */}
          {state === "idle" && <div className={styles.statusDot} />}

          {(state === "listening" || state === "responding") && (
            <div className={styles.equalizer}>
              <div className={styles.eqBar} />
              <div className={styles.eqBar} />
              <div className={styles.eqBar} />
              <div className={styles.eqBar} />
              <div className={styles.eqBar} />
            </div>
          )}

          {state === "thinking" && (
            <div className={styles.typingDots}>
              <div className={styles.typingDot} />
              <div className={styles.typingDot} />
              <div className={styles.typingDot} />
            </div>
          )}

          {state === "completed" && (
            <div className={styles.checkmarkWrapper}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SageOrbVisualizer;
