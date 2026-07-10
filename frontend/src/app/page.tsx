"use client";

import { useState, useEffect } from "react";
import ChatWindow from "@/components/ChatWindow";
import { MessageSquare, Plus, Bot, BarChart2, Database, CircleDot } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  const [threadId, setThreadId] = useState<string>("");
  const [threads, setThreads] = useState<{ id: string; label: string }[]>([]);

  // Generate initial session ID and thread list on client mount
  useEffect(() => {
    const initialId = `session-${Math.random().toString(36).substring(2, 11)}`;
    setThreadId(initialId);
    setThreads([{ id: initialId, label: "Current Active Chat" }]);
  }, []);

  const handleNewChat = () => {
    const newId = `session-${Math.random().toString(36).substring(2, 11)}`;
    setThreadId(newId);
    setThreads(prev => [{ id: newId, label: `Chat Session ${prev.length + 1}` }, ...prev]);
  };

  return (
    <main className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.logoArea}>
          <Bot className={styles.logoIcon} size={28} />
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

        <div className={styles.footer}>
          <div className={`${styles.footerItem} ${styles.footerItemActive}`}>
            <Bot size={16} style={{ color: "var(--accent-secondary)" }} />
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
