"use client";

import { useState, useEffect } from "react";
import ChatWindow from "@/components/ChatWindow";
import { MessageSquare, Plus, BrainCircuit, BarChart2, Database, CircleDot, Sun, Moon, Monitor } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  const [threadId, setThreadId] = useState<string>("");
  const [threads, setThreads] = useState<{ id: string; label: string }[]>([]);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  // Generate initial session ID and thread list on client mount
  useEffect(() => {
    const initialId = `session-${Math.random().toString(36).substring(2, 11)}`;
    setThreadId(initialId);
    setThreads([{ id: initialId, label: "Current Active Chat" }]);
    
    // Load theme setting
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark" | "system") || "system";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (t: "light" | "dark" | "system") => {
    const root = document.documentElement;
    let targetTheme = t;
    if (t === "system") {
      const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
      targetTheme = darkQuery.matches ? "dark" : "light";
    }
    
    if (targetTheme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  // Sync preference if system setting changes while on 'system' mode
  useEffect(() => {
    if (theme !== "system") return;
    
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      if (e.matches) {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", "light");
      }
    };
    
    darkQuery.addEventListener("change", listener);
    return () => darkQuery.removeEventListener("change", listener);
  }, [theme]);

  const handleNewChat = () => {
    const newId = `session-${Math.random().toString(36).substring(2, 11)}`;
    setThreadId(newId);
    setThreads(prev => [{ id: newId, label: `Chat Session ${prev.length + 1}` }, ...prev]);
  };

  return (
    <main className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.logoArea}>
          <BrainCircuit className={styles.logoIcon} size={28} />
          <span className={styles.logoText}>DataMind AI</span>
        </div>

        <button className={styles.newChatButton} onClick={handleNewChat}>
          <Plus size={18} />
          New Chat
        </button>

        <div className={styles.historySection}>
          <h3 className={styles.historyTitle}>Active Chats</h3>
          <div className={styles.threadList}>
            {threads.map(t => (
              <div
                key={t.id}
                className={t.id === threadId ? styles.threadItemActive : styles.threadItem}
                onClick={() => setThreadId(t.id)}
              >
                <MessageSquare size={16} />
                <span className={styles.threadText}>{t.label}</span>
                {t.id === threadId && <CircleDot size={8} style={{ color: "var(--accent-secondary)", marginLeft: "auto" }} />}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.themeSection}>
          <h3 className={styles.themeTitle}>Theme Mode</h3>
          <div className={styles.themeButtons}>
            <button
              className={`${styles.themeButton} ${theme === "light" ? styles.themeButtonActive : ""}`}
              onClick={() => handleThemeChange("light")}
            >
              <Sun size={14} />
              Light
            </button>
            <button
              className={`${styles.themeButton} ${theme === "dark" ? styles.themeButtonActive : ""}`}
              onClick={() => handleThemeChange("dark")}
            >
              <Moon size={14} />
              Dark
            </button>
            <button
              className={`${styles.themeButton} ${theme === "system" ? styles.themeButtonActive : ""}`}
              onClick={() => handleThemeChange("system")}
            >
              <Monitor size={14} />
              System
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <div className={`${styles.footerItem} ${styles.footerItemActive}`}>
            <BrainCircuit size={16} style={{ color: "var(--accent-secondary)" }} />
            <span style={{ color: "var(--text-primary)" }}>Phase 1: Chatbot (Active)</span>
          </div>
          <div className={styles.footerItem}>
            <Database size={16} />
            <span>Phase 2: RAG (Locked)</span>
          </div>
          <div className={styles.footerItem}>
            <BarChart2 size={16} />
            <span>Phase 3: Analysis (Locked)</span>
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <ChatWindow threadId={threadId} />
      </div>
    </main>
  );
}
