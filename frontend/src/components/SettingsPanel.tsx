"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, UserPlus, Trash2, Save, X, Sparkles, Brain, LogOut, BookOpen, Clock, Settings, Pencil } from "lucide-react";
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

interface UserEpisode {
  id: number;
  thread_id: string;
  summary: string;
  created_at: string;
}

interface UserProcedure {
  id: number;
  rule: string;
  source_thread_id: string | null;
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
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [episodes, setEpisodes] = useState<UserEpisode[]>([]);
  const [procedures, setProcedures] = useState<UserProcedure[]>([]);
  const [activeTab, setActiveTab] = useState<"profile" | "episodes" | "procedures" | "facts">("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileJson, setProfileJson] = useState("");
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemType, setEditingItemType] = useState<"episodes" | "procedures" | "facts" | null>(null);
  const [editingItemValue, setEditingItemValue] = useState("");

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch users (if admin) and settings when mounted or activeUserId changes
  useEffect(() => {
    if (userRole === "admin") {
      fetchUsers();
    }
    fetchUserSettings(activeUserId);
    fetchWikiMemory(activeUserId);
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

  const fetchWikiMemory = async (userId: string) => {
    setIsLoading(true);
    try {
      const [memRes, profRes, epRes, procRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/users/${userId}/memories`),
        fetch(`${apiBaseUrl}/api/users/${userId}/profile`),
        fetch(`${apiBaseUrl}/api/users/${userId}/episodes`),
        fetch(`${apiBaseUrl}/api/users/${userId}/procedures`)
      ]);
      
      if (memRes.ok) setMemories(await memRes.json());
      if (profRes.ok) setProfile(await profRes.json());
      if (epRes.ok) setEpisodes(await epRes.json());
      if (procRes.ok) setProcedures(await procRes.json());
    } catch (err) {
      console.error("Failed to fetch Wiki Memory:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfileJSON = async () => {
    try {
      const parsed = JSON.parse(profileJson);
      const res = await fetch(`${apiBaseUrl}/api/users/${activeUserId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: parsed })
      });
      if (res.ok) {
        setProfile(parsed);
        setEditingProfile(false);
      }
    } catch (err) {
      alert("Invalid JSON format");
      console.error(err);
    }
  };

  const handleDeleteMemory = async (type: "episodes" | "procedures" | "memories", id: number) => {
    if (!confirm("Delete this memory?")) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/${type}/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (type === "episodes") setEpisodes(prev => prev.filter(e => e.id !== id));
        if (type === "procedures") setProcedures(prev => prev.filter(p => p.id !== id));
        if (type === "memories") setMemories(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  const handleSaveMemoryItem = async () => {
    if (editingItemId === null || !editingItemType || !editingItemValue.trim()) {
      setEditingItemId(null);
      return;
    }
    const typeMapping = { episodes: "episodes", procedures: "procedures", facts: "memories" };
    const fieldMapping = { episodes: "summary", procedures: "rule", facts: "content" };
    
    try {
      const res = await fetch(`${apiBaseUrl}/api/${typeMapping[editingItemType]}/${editingItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldMapping[editingItemType]]: editingItemValue.trim() })
      });
      if (res.ok) {
        if (editingItemType === "episodes") {
          setEpisodes(prev => prev.map(e => e.id === editingItemId ? { ...e, summary: editingItemValue.trim() } : e));
        } else if (editingItemType === "procedures") {
          setProcedures(prev => prev.map(p => p.id === editingItemId ? { ...p, rule: editingItemValue.trim() } : p));
        } else if (editingItemType === "facts") {
          setMemories(prev => prev.map(m => m.id === editingItemId ? { ...m, content: editingItemValue.trim() } : m));
        }
      }
    } catch (err) {
      console.error("Failed to update memory:", err);
    }
    setEditingItemId(null);
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
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Brain className={styles.headerIcon} size={24} />
          <h2 className={styles.title}>System Control & Wiki Memory</h2>
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

        {/* Right Section: Wiki Memory Tabbed Area */}
        <div className={styles.rightCol}>
          <section className={styles.sectionMemory}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === "profile" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("profile")}
              >
                <User size={14} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                Structured Profile
              </button>
              <button
                className={`${styles.tab} ${activeTab === "episodes" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("episodes")}
              >
                <Clock size={14} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                Episodes ({episodes.length})
              </button>
              <button
                className={`${styles.tab} ${activeTab === "procedures" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("procedures")}
              >
                <Settings size={14} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                Behavioral Rules ({procedures.length})
              </button>
              <button
                className={`${styles.tab} ${activeTab === "facts" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("facts")}
              >
                <Sparkles size={14} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                Semantic Index ({memories.length})
              </button>
            </div>

            {isLoading ? (
              <div className={styles.loaderArea}>
                <div className={styles.loader}></div>
                <span>Loading Wiki Memory...</span>
              </div>
            ) : (
              <>
                {activeTab === "profile" && (
                  Object.keys(profile).length === 0 ? (
                    <div className={styles.emptyMemories}>
                      <User size={32} className={styles.emptyMemIcon} />
                      <p>No profile compiled yet.</p>
                      <span>The assistant will compile your structured user profile automatically as you interact.</span>
                    </div>
                  ) : (
                    <div className={styles.profileContainer}>
                      <div className={styles.profileHeaderControls}>
                        {!editingProfile ? (
                          <button className={styles.actionBtnProfile} onClick={() => { setProfileJson(JSON.stringify(profile, null, 2)); setEditingProfile(true); }}>
                            <Pencil size={12} style={{ marginRight: 6 }} /> Edit Raw JSON
                          </button>
                        ) : (
                          <div className={styles.editControls}>
                            <button className={styles.saveBtn} onClick={handleSaveProfileJSON}>Save</button>
                            <button className={styles.cancelBtn} onClick={() => setEditingProfile(false)}>Cancel</button>
                          </div>
                        )}
                      </div>
                      {editingProfile ? (
                        <textarea
                          className={styles.jsonEditor}
                          value={profileJson}
                          onChange={(e) => setProfileJson(e.target.value)}
                        />
                      ) : (
                        <div className={styles.profileGrid}>
                          {Object.entries(profile).map(([category, catData]) => (
                            <div key={category} className={styles.profileCard}>
                              <div className={styles.profileCardHeader}>
                                {category.replace('_', ' ')}
                              </div>
                              <div className={styles.profileCardBody}>
                                {typeof catData === "object" && !Array.isArray(catData) ? (
                                  Object.entries(catData).map(([key, val]) => (
                                    <div key={key} className={styles.profileItem}>
                                      <span className={styles.profileKey}>{key.replace('_', ' ')}</span>
                                      <span className={styles.profileVal}>{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                                    </div>
                                  ))
                                ) : Array.isArray(catData) ? (
                                  <span className={styles.profileVal}>{catData.map(v => typeof v === "object" ? JSON.stringify(v) : v).join(", ")}</span>
                                ) : (
                                  <span className={styles.profileVal}>{String(catData)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}

                {activeTab === "episodes" && (
                  episodes.length === 0 ? (
                    <div className={styles.emptyMemories}>
                      <Clock size={32} className={styles.emptyMemIcon} />
                      <p>No episodic memories summarized.</p>
                      <span>Past conversation summaries will be recorded here to preserve context across threads.</span>
                    </div>
                  ) : (
                    <div className={styles.memoryList}>
                      {episodes.map((ep) => (
                        <div key={ep.id} className={styles.memoryItem}>
                          <div className={styles.memoryContent}>
                            <span className={styles.memoryBullet}>✦</span>
                            <div style={{ flex: 1 }}>
                              {editingItemId === ep.id && editingItemType === "episodes" ? (
                                <textarea
                                  className={styles.editInputTextarea}
                                  value={editingItemValue}
                                  onChange={(e) => setEditingItemValue(e.target.value)}
                                  autoFocus
                                />
                              ) : (
                                <p className={styles.memoryText}>{ep.summary}</p>
                              )}
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Thread: {ep.thread_id.substring(0, 10)}... | {new Date(ep.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {editingItemId === ep.id && editingItemType === "episodes" ? (
                            <div className={styles.editControls}>
                              <button className={styles.saveBtn} onClick={handleSaveMemoryItem}>Save</button>
                              <button className={styles.cancelBtn} onClick={() => setEditingItemId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div className={styles.memoryActions}>
                              <button
                                className={styles.actionBtn}
                                onClick={() => { setEditingItemId(ep.id); setEditingItemType("episodes"); setEditingItemValue(ep.summary); }}
                                title="Edit episode"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className={styles.actionBtn}
                                onClick={() => handleDeleteMemory("episodes", ep.id)}
                                title="Delete episode"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {activeTab === "procedures" && (
                  procedures.length === 0 ? (
                    <div className={styles.emptyMemories}>
                      <Settings size={32} className={styles.emptyMemIcon} />
                      <p>No behavioral preferences learned.</p>
                      <span>Preferences about how the assistant should format code, explain things, etc., will appear here.</span>
                    </div>
                  ) : (
                    <div className={styles.memoryList}>
                      {procedures.map((p) => (
                        <div key={p.id} className={styles.memoryItem}>
                          <div className={styles.memoryContent}>
                            <span className={styles.memoryBullet}>✦</span>
                            <div style={{ flex: 1 }}>
                              {editingItemId === p.id && editingItemType === "procedures" ? (
                                <textarea
                                  className={styles.editInputTextarea}
                                  value={editingItemValue}
                                  onChange={(e) => setEditingItemValue(e.target.value)}
                                  autoFocus
                                />
                              ) : (
                                <p className={styles.memoryText}>{p.rule}</p>
                              )}
                              {p.source_thread_id && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Learned from thread: {p.source_thread_id.substring(0, 10)}...
                                </span>
                              )}
                            </div>
                          </div>
                          {editingItemId === p.id && editingItemType === "procedures" ? (
                            <div className={styles.editControls}>
                              <button className={styles.saveBtn} onClick={handleSaveMemoryItem}>Save</button>
                              <button className={styles.cancelBtn} onClick={() => setEditingItemId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div className={styles.memoryActions}>
                              <button
                                className={styles.actionBtn}
                                onClick={() => { setEditingItemId(p.id); setEditingItemType("procedures"); setEditingItemValue(p.rule); }}
                                title="Edit preference"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className={styles.actionBtn}
                                onClick={() => handleDeleteMemory("procedures", p.id)}
                                title="Delete preference"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {activeTab === "facts" && (
                  memories.length === 0 ? (
                    <div className={styles.emptyMemories}>
                      <Sparkles size={32} className={styles.emptyMemIcon} />
                      <p>No memories indexed.</p>
                      <span>Raw facts will appear here to power semantic search queries.</span>
                    </div>
                  ) : (
                    <div className={styles.memoryList}>
                      {memories.map((m) => (
                        <div key={m.id} className={styles.memoryItem}>
                          <div className={styles.memoryContent}>
                            <span className={styles.memoryBullet}>✦</span>
                            <div style={{ flex: 1 }}>
                              {editingItemId === m.id && editingItemType === "facts" ? (
                                <textarea
                                  className={styles.editInputTextarea}
                                  value={editingItemValue}
                                  onChange={(e) => setEditingItemValue(e.target.value)}
                                  autoFocus
                                />
                              ) : (
                                <p className={styles.memoryText}>{m.content}</p>
                              )}
                            </div>
                          </div>
                          {editingItemId === m.id && editingItemType === "facts" ? (
                            <div className={styles.editControls}>
                              <button className={styles.saveBtn} onClick={handleSaveMemoryItem}>Save</button>
                              <button className={styles.cancelBtn} onClick={() => setEditingItemId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div className={styles.memoryActions}>
                              <button
                                className={styles.actionBtn}
                                onClick={() => { setEditingItemId(m.id); setEditingItemType("facts"); setEditingItemValue(m.content); }}
                                title="Edit memory fact"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className={styles.actionBtn}
                                onClick={() => handleDeleteMemory("memories", m.id)}
                                title="Delete memory fact"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
