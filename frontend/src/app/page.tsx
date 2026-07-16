"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";
import SettingsPanel from "@/components/SettingsPanel";
import { MessageSquare, Plus, BrainCircuit, BarChart2, Database, CircleDot, Sun, Moon, Monitor, Settings, Users, Pencil, Trash2 } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  const [threadId, setThreadId] = useState<string>("");
  const [threads, setThreads] = useState<{ id: string; label: string }[]>([]);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [activeUsername, setActiveUsername] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("user");
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  const router = useRouter();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    const storedUserId = localStorage.getItem("activeUserId");
    const storedUsername = localStorage.getItem("activeUsername");
    const storedRole = localStorage.getItem("role");

    if (!storedUserId || !storedUsername) {
      router.push("/login");
    } else {
      setActiveUserId(storedUserId);
      setActiveUsername(storedUsername);
      setUserRole(storedRole || "user");
      setIsAuthChecking(false);
    }

    // Load theme setting
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark" | "system") || "system";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, [router]);

  useEffect(() => {
    if (!activeUserId) return;
    
    const refreshAndLoad = async () => {
      await fetchUserThreads(activeUserId);
      await fetchUserSettings(activeUserId);
    };
    
    refreshAndLoad();
  }, [activeUserId]);

  const fetchUserThreads = async (userId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/${userId}/threads`);
      if (res.ok) {
        const data = await res.json();
        const formattedThreads = data.map((t: any) => ({
          id: t.id,
          label: t.title || "Untitled Chat"
        }));
        setThreads(formattedThreads);
        
        if (formattedThreads.length > 0) {
          setThreadId(formattedThreads[0].id);
        } else {
          const initialId = `session-${Math.random().toString(36).substring(2, 11)}`;
          setThreadId(initialId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch user threads:", err);
    }
  };

  const fetchUserSettings = async (userId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/${userId}/settings`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.theme) {
          setTheme(data.theme);
          applyTheme(data.theme);
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

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
    setView("chat");
  };

  const handleSelectThread = (id: string) => {
    if (editingThreadId) return;
    setThreadId(id);
    setView("chat");
  };

  const handleRenameThread = async (id: string) => {
    if (!editTitleValue.trim()) {
      setEditingThreadId(null);
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/threads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitleValue.trim() })
      });
      if (res.ok) {
        setThreads(prev => prev.map(t => t.id === id ? { ...t, label: editTitleValue.trim() } : t));
      }
    } catch (err) {
      console.error("Failed to rename thread", err);
    }
    setEditingThreadId(null);
  };

  const handleDeleteThread = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat and its context?")) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/threads/${id}`, { method: "DELETE" });
      if (res.ok) {
        setThreads(prev => prev.filter(t => t.id !== id));
        if (threadId === id) {
          setThreadId("");
        }
      }
    } catch (err) {
      console.error("Failed to delete thread", err);
    }
  };

  if (isAuthChecking) {
    return null; // Or a loading spinner
  }

  return (
    <main className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.logoArea}>
          <BrainCircuit className={styles.logoIcon} size={28} />
          <span className={styles.logoText}>SAGE</span>
        </div>

        {/* User Switcher Info */}
        <div className={styles.userProfileArea}>
          <Users size={16} className={styles.userProfileIcon} />
          <span className={styles.activeUserLabel}>{activeUsername}</span>
        </div>

        <button className={styles.newChatButton} onClick={handleNewChat}>
          <Plus size={18} />
          New Chat
        </button>

        <div className={styles.historySection}>
          <h3 className={styles.historyTitle}>Active Chats</h3>
          <div className={styles.threadList}>
            {threads.length === 0 ? (
              <span className={styles.noHistoryText}>No threads found</span>
            ) : (
              threads.map(t => (
                <div
                  key={t.id}
                  className={t.id === threadId && view === "chat" ? styles.threadItemActive : styles.threadItem}
                  onClick={() => handleSelectThread(t.id)}
                >
                  <MessageSquare size={16} />
                  {editingThreadId === t.id ? (
                    <input
                      type="text"
                      className={styles.editInput}
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onBlur={() => handleRenameThread(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameThread(t.id);
                        if (e.key === "Escape") setEditingThreadId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className={styles.threadText}>{t.label}</span>
                  )}
                  {t.id === threadId && view === "chat" && !editingThreadId && (
                    <CircleDot size={8} style={{ color: "var(--accent-secondary)", marginLeft: "auto" }} />
                  )}
                  {!editingThreadId && (
                    <div className={styles.threadActions}>
                      <button
                        className={styles.actionButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingThreadId(t.id);
                          setEditTitleValue(t.label);
                        }}
                        title="Rename Chat"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={styles.actionButton}
                        onClick={(e) => handleDeleteThread(e, t.id)}
                        title="Delete Chat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Settings Toggle Link */}
        <button 
          className={`${styles.settingsButton} ${view === "settings" ? styles.settingsButtonActive : ""}`}
          onClick={() => setView(view === "chat" ? "settings" : "chat")}
        >
          <Settings size={16} />
          {view === "chat" ? "Settings & Memories" : "Back to Chat"}
        </button>

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
        {view === "chat" ? (
          <ChatWindow threadId={threadId} activeUserId={activeUserId} />
        ) : (
          <SettingsPanel
            activeUserId={activeUserId}
            userRole={userRole}
            onClose={() => setView("chat")}
            onThemeChanged={handleThemeChange}
          />
        )}
      </div>
    </main>
  );
}
