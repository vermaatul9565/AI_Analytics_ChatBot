"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import Mermaid from "./Mermaid";
import styles from "./MarkdownRenderer.module.css";

interface MarkdownRendererProps {
  content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      className={styles.copyButton}
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy code"}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      <span>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const checkTheme = () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      setTheme(isLight ? "light" : "dark");
    };

    const observer = new MutationObserver(checkTheme);
    checkTheme();

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    return () => observer.disconnect();
  }, []);

  const syntaxTheme = theme === "light" ? oneLight : oneDark;

  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        components={{
          // Code blocks and inline code
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isInline = inline || (!match && !codeString.includes("\n"));

            if (isInline) {
              return (
                <code className={styles.inlineCode} {...props}>
                  {children}
                </code>
              );
            }

            const language = match ? match[1] : "text";

            if (language === "mermaid") {
              return <Mermaid chart={codeString} />;
            }

            return (
              <div className={styles.codeBlockWrapper}>
                <div className={styles.codeBlockHeader}>
                  <span className={styles.codeLanguage}>{language}</span>
                  <CopyButton text={codeString} />
                </div>
                <SyntaxHighlighter
                  style={syntaxTheme}
                  language={language}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: "0 0 8px 8px",
                    padding: "1rem",
                    fontSize: "0.85rem",
                    background: "var(--bg-tertiary)",
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    },
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },

          // Paragraphs
          p({ children }) {
            return <p className={styles.paragraph}>{children}</p>;
          },

          // Headers
          h1({ children }) {
            return <h1 className={styles.h1}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 className={styles.h2}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 className={styles.h3}>{children}</h3>;
          },
          h4({ children }) {
            return <h4 className={styles.h4}>{children}</h4>;
          },

          // Lists
          ul({ children }) {
            return <ul className={styles.ul}>{children}</ul>;
          },
          ol({ children }) {
            return <ol className={styles.ol}>{children}</ol>;
          },
          li({ children }) {
            return <li className={styles.li}>{children}</li>;
          },

          // Blockquote
          blockquote({ children }) {
            return <blockquote className={styles.blockquote}>{children}</blockquote>;
          },

          // Table
          table({ children }) {
            return (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className={styles.th}>{children}</th>;
          },
          td({ children }) {
            return <td className={styles.td}>{children}</td>;
          },

          // Horizontal rule
          hr() {
            return <hr className={styles.hr} />;
          },

          // Links
          a({ href, children }) {
            return (
              <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },

          // Strong / Bold
          strong({ children }) {
            return <strong className={styles.strong}>{children}</strong>;
          },

          // Pre (wrapping code blocks)
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
