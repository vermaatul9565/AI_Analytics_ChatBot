"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";
import SettingsPanel from "@/components/SettingsPanel";
import KnowledgePanel from "@/components/KnowledgePanel";
import { 
  MessageSquare, Plus, BrainCircuit, BarChart2, 
  Database, CircleDot, Settings, Users, Pencil, Trash2, 
  Search, BookOpen, Clock, Play
} from "lucide-react";
import styles from "./page.module.css";
import SageLogo from "@/components/SageLogo";

interface ChatThread {
  id: string;
  label: string;
  createdAt?: Date;
}

export default function Home() {
  const [threadId, setThreadId] = useState<string>("");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [activeUsername, setActiveUsername] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("user");
  const [view, setView] = useState<"chat" | "profile" | "knowledge" | "analytics" | "automations" | "settings">("chat");
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [searchThreadQuery, setSearchThreadQuery] = useState("");

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
        const cleanTitle = (rawTitle: string) => {
          if (!rawTitle) return "Untitled Chat";
          const cleaned = rawTitle.replace(/<details>[\s\S]*?<\/details>/gi, '').replace(/<summary>[\s\S]*?<\/summary>/gi, '').trim();
          return cleaned || "Attached Document";
        };
        const formattedThreads = data.map((t: any) => ({
          id: t.id,
          label: cleanTitle(t.title),
          createdAt: t.created_at ? new Date(t.created_at) : new Date()
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
    setThreads(prev => [{ id: newId, label: `Chat Session ${prev.length + 1}`, createdAt: new Date() }, ...prev]);
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

  // Group threads chronologically
  const getGroupedThreads = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const groups: { [key: string]: ChatThread[] } = {
      "Today": [],
      "Yesterday": [],
      "Previous 7 Days": [],
      "Older": []
    };

    const filtered = threads.filter(t => 
      t.label.toLowerCase().includes(searchThreadQuery.toLowerCase())
    );

    filtered.forEach(t => {
      const threadDate = t.createdAt ? new Date(t.createdAt) : new Date();
      if (threadDate >= today) {
        groups["Today"].push(t);
      } else if (threadDate >= yesterday) {
        groups["Yesterday"].push(t);
      } else if (threadDate >= oneWeekAgo) {
        groups["Previous 7 Days"].push(t);
      } else {
        groups["Older"].push(t);
      }
    });

    return groups;
  };

  if (isAuthChecking) {
    return null;
  }

  const groupedThreads = getGroupedThreads();

  return (
    <main className={styles.container}>
      <div className={styles.sidebar}>
        {/* Logo area */}
        <div className={styles.logoArea}>
          <SageLogo variant="sidebar" />
        </div>



        {/* Persistent Workspace Selection Links */}
        <div className={styles.workspaceSection}>
          <h4 className={styles.sidebarHeader}>Workspace Modules</h4>
          <div className={styles.workspaceList}>
            <button 
              className={`${styles.workspaceLink} ${view === "chat" ? styles.workspaceLinkActive : ""}`}
              onClick={() => setView("chat")}
            >
              <MessageSquare size={16} />
              <span>Conversational Chat</span>
            </button>
            <button 
              className={`${styles.workspaceLink} ${view === "knowledge" ? styles.workspaceLinkActive : ""}`}
              onClick={() => setView("knowledge")}
            >
              <BookOpen size={16} />
              <span>Knowledge Base</span>
            </button>
            <button 
              className={`${styles.workspaceLink} ${view === "analytics" ? styles.workspaceLinkActive : ""}`}
              onClick={() => setView("analytics")}
            >
              <BarChart2 size={16} />
              <span>Database Analytics</span>
            </button>
            <button 
              className={`${styles.workspaceLink} ${view === "automations" ? styles.workspaceLinkActive : ""}`}
              onClick={() => setView("automations")}
            >
              <Database size={16} />
              <span>Agents & Automations</span>
            </button>
          </div>
        </div>

        <div className={styles.divider}></div>

        {/* Active chats control */}
        <div className={styles.chatHistoryControl}>
          <button className={styles.newChatButton} onClick={handleNewChat}>
            <Plus size={14} />
            <span>New Session</span>
          </button>

          <div className={styles.historySearchWrapper}>
            <Search size={12} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search chat sessions..." 
              value={searchThreadQuery}
              onChange={(e) => setSearchThreadQuery(e.target.value)}
              className={styles.historySearchInput}
            />
          </div>
        </div>

        {/* Thread History list grouped chronologically */}
        <div className={styles.historySection}>
          {threads.length === 0 ? (
            <span className={styles.noHistoryText}>No sessions found</span>
          ) : (
            Object.entries(groupedThreads).map(([groupTitle, groupItems]) => {
              if (groupItems.length === 0) return null;
              return (
                <div key={groupTitle} className={styles.historyGroup}>
                  <h4 className={styles.historyGroupTitle}>{groupTitle}</h4>
                  <div className={styles.threadList}>
                    {groupItems.map(t => (
                      <div
                        key={t.id}
                        className={t.id === threadId && view === "chat" ? styles.threadItemActive : styles.threadItem}
                        onClick={() => handleSelectThread(t.id)}
                      >
                        <MessageSquare size={14} className={styles.threadIcon} />
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
                          <CircleDot size={6} className={styles.activeDot} />
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
                              title="Rename Session"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              className={styles.actionButton}
                              onClick={(e) => handleDeleteThread(e, t.id)}
                              title="Delete Session"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Controls like Gemini */}
        <div className={styles.sidebarFooter}>
          <div 
            className={`${styles.userProfileFooter} ${view === "profile" ? styles.userProfileFooterActive : ""}`}
            onClick={() => setView("profile")}
            title="View profile & long-term memory"
          >
            <div className={styles.avatarMini}>
              {activeUsername.substring(0, 2).toUpperCase()}
            </div>
            <div className={styles.profileTextWrapper}>
              <span className={styles.activeUserLabel}>{activeUsername}</span>
            </div>
          </div>
          
          <button 
            className={`${styles.settingsIconBtn} ${view === "settings" ? styles.settingsIconBtnActive : ""}`}
            onClick={() => setView("settings")}
            title="System Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className={styles.mainContent}>
        {view === "chat" && (
          <ChatWindow threadId={threadId} activeUserId={activeUserId} activeUsername={activeUsername} />
        )}
        {view === "profile" && (
          <KnowledgePanel activeUserId={activeUserId} />
        )}
        {view === "knowledge" && (
          <div className={styles.placeholderWorkspace}>
            <BookOpen size={36} className={styles.placeholderIcon} />
            <h3 className={styles.placeholderTitle}>Internal Documentation Knowledge Base (RAG)</h3>
            <p className={styles.placeholderDesc}>
              Connect internal documentation sources (PDFs, Markdown wikis, web scraping logs) to ground SAGE answers on custom enterprise knowledge databases.
            </p>
            <div className={styles.placeholderActionBadge} style={{ color: "var(--accent-primary)", borderColor: "rgba(59, 130, 246, 0.2)" }}>
              <Play size={12} />
              <span>Phase 2 Target (Locked)</span>
            </div>
            <button className={styles.placeholderBtn} onClick={() => setView("chat")}>Return to Conversations</button>
          </div>
        )}
        {view === "settings" && (
          <SettingsPanel
            activeUserId={activeUserId}
            userRole={userRole}
            onClose={() => setView("chat")}
            onThemeChanged={handleThemeChange}
          />
        )}
        {view === "analytics" && (
          <div className={styles.placeholderWorkspace}>
            <BarChart2 size={36} className={styles.placeholderIcon} />
            <h3 className={styles.placeholderTitle}>Database Analytics Workspace</h3>
            <p className={styles.placeholderDesc}>
              Connect SQL relational databases (AlloyDB, PostgreSQL, BigQuery) to query databases directly, view properties graphs, compile schemas, and render analytical reports.
            </p>
            <div className={styles.placeholderActionBadge}>
              <Play size={12} />
              <span>Phase 3 Target (Locked)</span>
            </div>
            <button className={styles.placeholderBtn} onClick={() => setView("chat")}>Return to Conversations</button>
          </div>
        )}
        {view === "automations" && (
          <div className={styles.placeholderWorkspace}>
            <BrainCircuit size={36} className={styles.placeholderIcon} />
            <h3 className={styles.placeholderTitle}>Agents & Workflow Automation</h3>
            <p className={styles.placeholderDesc}>
              Build cron-scheduled tasks, establish webhook workflows, connect local model endpoints, and register remote Model Context Protocol (MCP) servers.
            </p>
            <div className={styles.placeholderActionBadge} style={{ color: "var(--accent-secondary)", borderColor: "rgba(6, 182, 212, 0.2)" }}>
              <Play size={12} />
              <span>Phase 4 Target (Locked)</span>
            </div>
            <button className={styles.placeholderBtn} onClick={() => setView("chat")}>Return to Conversations</button>
          </div>
        )}
      </div>
    </main>
  );
}
