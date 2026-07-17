"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, UserPlus, Save, X, LogOut, Settings, ShieldAlert, Monitor, Sun, Moon } from "lucide-react";
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (userRole === "admin") {
      fetchUsers();
    }
    fetchUserSettings(activeUserId);
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

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Settings className={styles.headerIcon} size={22} />
          <div>
            <h2 className={styles.title}>System Settings & Configuration</h2>
            <span className={styles.subtitle}>Manage model routing behavior, system directives, and active user credentials.</span>
          </div>
        </div>
        <button onClick={onClose} className={styles.closeButton} title="Close Panel">
          <X size={20} />
        </button>
      </header>

      <div className={styles.container}>
        <div className={styles.settingsGrid}>
          {/* Section 1: Preferences & Custom Instructions */}
          <form onSubmit={handleSaveSettings} className={styles.settingsForm}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <Settings size={16} /> Assistant Directives & Defaults
              </h3>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Active UI Theme</label>
                <div className={styles.themeSelectorGrid}>
                  <button
                    type="button"
                    className={`${styles.themeOption} ${settings.theme === "light" ? styles.themeOptionActive : ""}`}
                    onClick={() => setSettings({ ...settings, theme: "light" })}
                  >
                    <Sun size={14} /> Light
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeOption} ${settings.theme === "dark" ? styles.themeOptionActive : ""}`}
                    onClick={() => setSettings({ ...settings, theme: "dark" })}
                  >
                    <Moon size={14} /> Dark
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeOption} ${settings.theme === "system" ? styles.themeOptionActive : ""}`}
                    onClick={() => setSettings({ ...settings, theme: "system" })}
                  >
                    <Monitor size={14} /> System
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Preferred Model (Override Dynamic Router)</label>
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
                <span className={styles.fieldHelp}>
                  Setting this overrides the dynamic auto routing engine and forces SAGE to execute all requests on the selected model.
                </span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Custom System Directives</label>
                <textarea
                  className={styles.textarea}
                  placeholder="E.g., 'You are a senior data scientist. Keep explanations concise, use tables when displaying numbers, and highlight architectural decisions.'"
                  value={settings.system_instructions}
                  onChange={(e) => setSettings({ ...settings, system_instructions: e.target.value })}
                  rows={5}
                />
                <span className={styles.fieldHelp}>
                  These directives are injected into SAGE's system prompt to enforce custom rules or response formatting.
                </span>
              </div>

              <button type="submit" className={styles.saveButton} disabled={saveStatus === "saving"}>
                {saveStatus === "saving"
                  ? "Saving configuration..."
                  : saveStatus === "success"
                  ? "Saved Successfully!"
                  : saveStatus === "error"
                  ? "Error Saving Configuration"
                  : "Save Preferences"}
              </button>
            </div>
          </form>

          {/* Section 2: Account & Admin Settings */}
          <div className={styles.sidebarCol}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <User size={16} /> Account Profile
              </h3>
              
              <div className={styles.accountCard}>
                <div className={styles.avatar}>
                  {activeUserId.substring(0, 2).toUpperCase()}
                </div>
                <div className={styles.accountInfo}>
                  <span className={styles.accountName}>Atul Verma</span>
                  <span className={styles.accountRole}>Role: {userRole}</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  localStorage.clear();
                  router.push('/login');
                }} 
                className={styles.logoutButton}
              >
                <LogOut size={14} /> Close Session & Logout
              </button>
            </div>

            {userRole === "admin" && (
              <div className={styles.section} style={{ borderColor: "rgba(245, 158, 11, 0.2)" }}>
                <h3 className={styles.sectionTitle} style={{ color: "#f59e0b" }}>
                  <ShieldAlert size={16} /> Admin Panel: User Administration
                </h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>Registered Accounts</label>
                  <select className={styles.select} defaultValue={activeUserId}>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} {u.id === activeUserId ? "(You)" : ""}
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
                    <UserPlus size={14} /> Provision New Account
                  </button>
                ) : (
                  <form onSubmit={handleCreateUser} className={styles.createUserForm}>
                    <input
                      type="text"
                      placeholder="Username (e.g. atul_dev)"
                      className={styles.input}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      maxLength={20}
                      required
                      autoFocus
                    />
                    <div className={styles.createUserButtons}>
                      <button type="submit" className={styles.createUserBtn}>
                        Provision
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
