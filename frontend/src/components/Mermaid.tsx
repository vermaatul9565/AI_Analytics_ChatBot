"use client";

import React, { useEffect, useState } from "react";
import mermaid from "mermaid";

interface MermaidProps {
  chart: string;
}

let mermaidInitialized = false;

export default function Mermaid({ chart }: MermaidProps) {
  const [mounted, setMounted] = useState(false);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!mermaidInitialized) {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          themeVariables: {
            background: "transparent",
            primaryColor: "#06b6d4",
            primaryTextColor: "#fff",
            lineColor: "rgba(255, 255, 255, 0.15)",
            textColor: "#e2e8f0",
          }
        });
        mermaidInitialized = true;
      } catch (initErr) {
        console.error("Mermaid initialization error:", initErr);
      }
    }

    const renderChart = async () => {
      try {
        setError(null);
        const id = `mermaid-${Math.floor(Math.random() * 1000000)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
      } catch (err: any) {
        console.error("Mermaid rendering failed:", err);
        setError("Failed to render diagram. Please verify Mermaid syntax.");
        setSvg("");
      }
    };

    renderChart();
  }, [chart, mounted]);

  if (!mounted) {
    return (
      <pre style={{ background: "rgba(0,0,0,0.15)", padding: "1rem", borderRadius: "8px", fontFamily: "monospace", fontSize: "0.85rem", overflowX: "auto" }}>
        {chart}
      </pre>
    );
  }

  if (error) {
    return (
      <div style={{ border: "1px dashed rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.05)", padding: "1rem", borderRadius: "8px", margin: "0.75rem 0" }}>
        <div style={{ color: "#f87171", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>⚠️ {error}</div>
        <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.5)", overflowX: "auto" }}>{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1rem", color: "rgba(255, 255, 255, 0.4)", fontSize: "0.85rem" }}>
        <div style={{ 
          width: "14px", 
          height: "14px", 
          borderRadius: "50%", 
          border: "2px solid rgba(255, 255, 255, 0.4)", 
          borderTopColor: "transparent", 
          animation: "spin 1s linear infinite" 
        }}>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
        <span>Compiling diagram...</span>
      </div>
    );
  }

  return (
    <div 
      className="mermaid-chart" 
      dangerouslySetInnerHTML={{ __html: svg }} 
      style={{ 
        background: "rgba(255, 255, 255, 0.015)", 
        border: "1px solid rgba(255, 255, 255, 0.05)", 
        borderRadius: "8px", 
        padding: "1.5rem", 
        margin: "0.75rem 0",
        display: "flex",
        justifyContent: "center",
        overflowX: "auto"
      }}
    />
  );
}
