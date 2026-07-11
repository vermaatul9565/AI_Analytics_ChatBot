"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, UserPlus, Trash2, Save, X, Sparkles, Brain, LogOut } from "lucide-react";
import styles from "./SettingsPanel.module.css";

interface SettingsPanelProps {
  activeUserId: string;
  userRole: string;
  onClose: () => void;
  onThemeChanged: (theme: "light" | "dark" | "system") => void;
}

interface UserProfile {
  id: string;
  username: string;
}

interface UserSettings {
  user_id: string;
  theme: string;
  preferred_model: string;
  system_instructions: string;
}

interface MemoryItem {
  id: number;
  content: string;
  created_at: string;
}

const UNIFIED_MODELS = [
  { id: "auto", name: "Auto Mode (Intelligent)" },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite (Low)" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash (Medium)" },
  { id: "gemini-3.5-flash-high", name: "Gemini 3.5 Flash (High)" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Low)" },
  { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
  { id: "gpt-4.6-omni", name: "GPT 4.6 Omni" }
];

export default function SettingsPanel({
  activeUserId,
  userRole,
  onClose,
  onThemeChanged
}: SettingsPanelProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    user_id: activeUserId,
    theme: "system",
    preferred_model: "auto",
    system_instructions: ""
  });
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch users (if admin) and settings when mounted or activeUserId changes
  useEffect(() => {
    if (userRole === "admin") {
      fetchUsers();
    }
    fetchUserSettings(activeUserId);
    fetchUserMemories(activeUserId);
  }, [activeUserId, userRole]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchUserSettings = async (userId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/${userId}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const fetchUserMemories = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/users/${userId}/memories`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), role: "user" })
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) => [...prev, data]);
        setNewUsername("");
        setIsCreatingUser(false);
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to create user profile");
      }
    } catch (err) {
      console.error("Error creating user:", err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("saving");

    try {
      const res = await fetch(`${apiBaseUrl}/api/users/${activeUserId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: settings.theme,
          preferred_model: settings.preferred_model,
          system_instructions: settings.system_instructions
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        onThemeChanged(data.theme as "light" | "dark" | "system");
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      setSaveStatus("error");
    }
  };

  const handleDeleteMemory = async (memoryId: number) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/memories/${memoryId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      } else {
        alert("Failed to delete memory item.");
      }
    } catch (err) {
      console.error("Error deleting memory:", err);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Brain className={styles.headerIcon} size={24} />
          <h2 className={styles.title}>System Control & User Memory</h2>
        </div>
        <button onClick={onClose} className={styles.closeButton} title="Back to Chat">
          <X size={20} />
        </button>
      </header>

      <div className={styles.body}>
        {/* Left Section: User Switcher and Settings */}
        <div className={styles.leftCol}>
          <section className={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                <User size={16} /> User Account Profile
              </h3>
              <button 
                onClick={() => {
                  localStorage.clear();
                  router.push('/login');
                }} 
                className={styles.secondaryButton}
                style={{ padding: '0.4rem 0.8rem', color: '#ef4444', borderColor: '#ef4444' }}
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          </section>

          {userRole === "admin" && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <UserPlus size={16} /> Admin: Manage Users
              </h3>
              <div className={styles.formGroup}>
                <label className={styles.label}>Registered Users</label>
                <select className={styles.select} disabled>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>

              {!isCreatingUser ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setIsCreatingUser(true)}
                >
                  <UserPlus size={14} /> Create New User
                </button>
              ) : (
                <form onSubmit={handleCreateUser} className={styles.createUserForm}>
                  <input
                    type="text"
                    placeholder="Enter new username"
                    className={styles.input}
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    maxLength={20}
                    required
                    autoFocus
                  />
                  <div className={styles.createUserButtons}>
                    <button type="submit" className={styles.createUserBtn}>
                      Create
                    </button>
                    <button
                      type="button"
                      className={styles.cancelCreateBtn}
                      onClick={() => setIsCreatingUser(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Save size={16} /> Preferences & Rules
            </h3>
            <form onSubmit={handleSaveSettings} className={styles.settingsForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Active UI Theme</label>
                <select
                  className={styles.select}
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                >
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                  <option value="system">System Preference</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Preferred Model (Auto Routing Override)</label>
                <select
                  className={styles.select}
                  value={settings.preferred_model}
                  onChange={(e) => setSettings({ ...settings, preferred_model: e.target.value })}
                >
                  {UNIFIED_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Custom System instructions</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Tell the assistant how to behave. E.g.: 'You are a senior systems architect. Keep answers extremely short and include markdown tables.'"
                  value={settings.system_instructions}
                  onChange={(e) =>
                    setSettings({ ...settings, system_instructions: e.target.value })
                  }
                  rows={4}
                />
              </div>

              <button type="submit" className={styles.saveButton} disabled={saveStatus === "saving"}>
                <Save size={14} />
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "success"
                  ? "Saved Successfully!"
                  : saveStatus === "error"
                  ? "Error Saving"
                  : "Save Preferences"}
              </button>
            </form>
          </section>
        </div>

        {/* Right Section: Semantic Memories */}
        <div className={styles.rightCol}>
          <section className={styles.sectionMemory}>
            <div className={styles.sectionMemoryHeader}>
              <h3 className={styles.sectionTitle}>
                <Sparkles size={16} style={{ color: "var(--accent-secondary)" }} />
                Extracted Semantic Memories
              </h3>
              <span className={styles.memoryCount}>{memories.length} facts</span>
            </div>
            <p className={styles.sectionDesc}>
              These facts are automatically extracted in the background from your chat sessions.
              They are embedded in a vector index to provide personalization dynamically.
            </p>

            {isLoading ? (
              <div className={styles.loaderArea}>
                <div className={styles.loader}></div>
                <span>Loading memories...</span>
              </div>
            ) : memories.length === 0 ? (
              <div className={styles.emptyMemories}>
                <Brain size={32} className={styles.emptyMemIcon} />
                <p>No memories extracted yet.</p>
                <span>Memories will appear here automatically as you chat and share preferences.</span>
              </div>
            ) : (
              <div className={styles.memoryList}>
                {memories.map((m) => (
                  <div key={m.id} className={styles.memoryItem}>
                    <div className={styles.memoryContent}>
                      <span className={styles.memoryBullet}>✦</span>
                      <p className={styles.memoryText}>{m.content}</p>
                    </div>
                    <button
                      className={styles.deleteMemoryBtn}
                      onClick={() => handleDeleteMemory(m.id)}
                      title="Delete memory fact"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
