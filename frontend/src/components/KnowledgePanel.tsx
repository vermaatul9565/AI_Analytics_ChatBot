"use client";

import React, { useState, useEffect } from "react";
import { 
  BookOpen, Clock, Settings, Sparkles, User, 
  Trash2, Pencil, Search, AlertCircle, RefreshCw, ChevronRight, Check
} from "lucide-react";
import styles from "./KnowledgePanel.module.css";

interface KnowledgePanelProps {
  activeUserId: string;
  onClose?: () => void;
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

export default function KnowledgePanel({ activeUserId, onClose }: KnowledgePanelProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "episodes" | "rules" | "facts">("profile");
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [episodes, setEpisodes] = useState<UserEpisode[]>([]);
  const [procedures, setProcedures] = useState<UserProcedure[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileJson, setProfileJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemType, setEditingItemType] = useState<"episodes" | "procedures" | "facts" | null>(null);
  const [editingItemValue, setEditingItemValue] = useState("");

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (activeUserId) {
      fetchWikiMemory(activeUserId);
    }
  }, [activeUserId]);

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
      setJsonError(null);
      const res = await fetch(`${apiBaseUrl}/api/users/${activeUserId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: parsed })
      });
      if (res.ok) {
        setProfile(parsed);
        setEditingProfile(false);
      } else {
        setJsonError("Failed to save profile on backend");
      }
    } catch (err: any) {
      setJsonError(`Invalid JSON format: ${err.message}`);
    }
  };

  const handleDeleteMemory = async (type: "episodes" | "procedures" | "memories", id: number) => {
    if (!confirm("Are you sure you want to delete this memory item?")) return;
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

  // Counting attributes helper for stats card
  const countProfileAttributes = () => {
    let count = 0;
    Object.values(profile).forEach(cat => {
      if (typeof cat === "object" && !Array.isArray(cat)) {
        count += Object.keys(cat).length;
      } else if (Array.isArray(cat)) {
        count += cat.length;
      } else if (cat) {
        count += 1;
      }
    });
    return count;
  };

  // Filters for tabs search
  const filteredEpisodes = episodes.filter(e => 
    e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.thread_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProcedures = procedures.filter(p => 
    p.rule.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMemories = memories.filter(m => 
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <BookOpen className={styles.headerIcon} size={22} />
          <div>
            <h2 className={styles.title}>Knowledge Base & Wiki Memory</h2>
            <span className={styles.subtitle}>Manage SAGE's cognitive state, semantic index, rules, and profile attributes.</span>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={() => fetchWikiMemory(activeUserId)} title="Sync database">
          <RefreshCw size={16} />
        </button>
      </header>

      {/* Cognitive Stats Dashboard Grid */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statsCard} ${activeTab === "profile" ? styles.statsCardActive : ""}`} onClick={() => setActiveTab("profile")}>
          <div className={styles.statsIconWrapper} style={{ color: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.08)" }}>
            <User size={18} />
          </div>
          <div className={styles.statsContent}>
            <span className={styles.statsVal}>{countProfileAttributes()}</span>
            <span className={styles.statsLabel}>Profile Attributes</span>
          </div>
        </div>

        <div className={`${styles.statsCard} ${activeTab === "episodes" ? styles.statsCardActive : ""}`} onClick={() => setActiveTab("episodes")}>
          <div className={styles.statsIconWrapper} style={{ color: "#8b5cf6", backgroundColor: "rgba(139, 92, 246, 0.08)" }}>
            <Clock size={18} />
          </div>
          <div className={styles.statsContent}>
            <span className={styles.statsVal}>{episodes.length}</span>
            <span className={styles.statsLabel}>Thread Summaries</span>
          </div>
        </div>

        <div className={`${styles.statsCard} ${activeTab === "rules" ? styles.statsCardActive : ""}`} onClick={() => setActiveTab("rules")}>
          <div className={styles.statsIconWrapper} style={{ color: "#ec4899", backgroundColor: "rgba(236, 72, 153, 0.08)" }}>
            <Settings size={18} />
          </div>
          <div className={styles.statsContent}>
            <span className={styles.statsVal}>{procedures.length}</span>
            <span className={styles.statsLabel}>Behavior Rules</span>
          </div>
        </div>

        <div className={`${styles.statsCard} ${activeTab === "facts" ? styles.statsCardActive : ""}`} onClick={() => setActiveTab("facts")}>
          <div className={styles.statsIconWrapper} style={{ color: "#06b6d4", backgroundColor: "rgba(6, 182, 212, 0.08)" }}>
            <Sparkles size={18} />
          </div>
          <div className={styles.statsContent}>
            <span className={styles.statsVal}>{memories.length}</span>
            <span className={styles.statsLabel}>Indexed Facts</span>
          </div>
        </div>
      </div>

      <div className={styles.workspaceBody}>
        {/* Navigation Tabs and Search */}
        <div className={styles.tabsRow}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${activeTab === "profile" ? styles.activeTab : ""}`} onClick={() => { setActiveTab("profile"); setSearchQuery(""); }}>
              Structured Profile
            </button>
            <button className={`${styles.tab} ${activeTab === "episodes" ? styles.activeTab : ""}`} onClick={() => { setActiveTab("episodes"); setSearchQuery(""); }}>
              Episodes Timeline
            </button>
            <button className={`${styles.tab} ${activeTab === "rules" ? styles.activeTab : ""}`} onClick={() => { setActiveTab("rules"); setSearchQuery(""); }}>
              Behavioral Rules
            </button>
            <button className={`${styles.tab} ${activeTab === "facts" ? styles.activeTab : ""}`} onClick={() => { setActiveTab("facts"); setSearchQuery(""); }}>
              Semantic Index
            </button>
          </div>

          {activeTab !== "profile" && (
            <div className={styles.searchWrapper}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Content Renderers */}
        {isLoading ? (
          <div className={styles.loaderArea}>
            <div className={styles.spinner}></div>
            <span>Synchronizing cognitive memory workspace...</span>
          </div>
        ) : (
          <div className={styles.tabContentArea}>
            {/* 1. Structured Profile Tab */}
            {activeTab === "profile" && (
              Object.keys(profile).length === 0 ? (
                <div className={styles.emptyMemories}>
                  <User size={36} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                  <p className={styles.emptyTitle}>No compiled profile data</p>
                  <span className={styles.emptyDesc}>SAGE automatically updates your preferences, roles, and project attributes as you converse.</span>
                </div>
              ) : (
                <div className={styles.profileWorkspace}>
                  <div className={styles.profileActionsRow}>
                    <span className={styles.panelMeta}>This JSON summarizes everything SAGE knows about your work stack, preferences, and personal details.</span>
                    {!editingProfile ? (
                      <button className={styles.editRawBtn} onClick={() => { setProfileJson(JSON.stringify(profile, null, 2)); setEditingProfile(true); setJsonError(null); }}>
                        <Pencil size={12} /> Edit raw data
                      </button>
                    ) : (
                      <div className={styles.profileEditingControls}>
                        <button className={styles.saveProfileBtn} onClick={handleSaveProfileJSON}>
                          <Check size={12} /> Save changes
                        </button>
                        <button className={styles.cancelProfileBtn} onClick={() => setEditingProfile(false)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {editingProfile ? (
                    <div className={styles.jsonEditorContainer}>
                      <textarea
                        className={styles.jsonTextarea}
                        value={profileJson}
                        onChange={(e) => setProfileJson(e.target.value)}
                        autoFocus
                      />
                      {jsonError && (
                        <div className={styles.jsonErrorBadge}>
                          <AlertCircle size={14} />
                          <span>{jsonError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.profileGrid}>
                      {Object.entries(profile).map(([category, catValue]) => (
                        <div key={category} className={styles.profileCard}>
                          <div className={styles.profileCardHeader}>
                            {category.replace(/_/g, ' ')}
                          </div>
                          <div className={styles.profileCardBody}>
                            {typeof catValue === "object" && !Array.isArray(catValue) ? (
                              Object.entries(catValue).map(([key, val]) => (
                                <div key={key} className={styles.profileItem}>
                                  <span className={styles.profileKey}>{key.replace(/_/g, ' ')}</span>
                                  <span className={styles.profileVal}>{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                                </div>
                              ))
                            ) : Array.isArray(catValue) ? (
                              <div className={styles.profileTagsList}>
                                {catValue.map((v, i) => (
                                  <span key={i} className={styles.profileTag}>
                                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.profileValText}>{String(catValue)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}

            {/* 2. Episodic Memory Timeline Tab */}
            {activeTab === "episodes" && (
              filteredEpisodes.length === 0 ? (
                <div className={styles.emptyMemories}>
                  <Clock size={36} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                  <p className={styles.emptyTitle}>No matching episodic summaries</p>
                  <span className={styles.emptyDesc}>Conversation summaries are recorded here when threads close to allow cross-session retrieval.</span>
                </div>
              ) : (
                <div className={styles.timeline}>
                  {filteredEpisodes.map((ep) => (
                    <div key={ep.id} className={styles.timelineItem}>
                      <div className={styles.timelineBadge}>
                        <Clock size={12} />
                      </div>
                      <div className={styles.timelineCard}>
                        <div className={styles.timelineHeader}>
                          <span className={styles.timelineDate}>
                            {new Date(ep.created_at).toLocaleDateString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <span className={styles.timelineThreadId}>Thread: {ep.thread_id.substring(0, 15)}...</span>
                        </div>
                        <div className={styles.timelineContent}>
                          {editingItemId === ep.id && editingItemType === "episodes" ? (
                            <textarea
                              className={styles.itemEditTextarea}
                              value={editingItemValue}
                              onChange={(e) => setEditingItemValue(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            <p className={styles.timelineText}>{ep.summary}</p>
                          )}
                        </div>
                        <div className={styles.timelineFooter}>
                          {editingItemId === ep.id && editingItemType === "episodes" ? (
                            <div className={styles.inlineEditControls}>
                              <button className={styles.inlineSaveBtn} onClick={handleSaveMemoryItem}>Save</button>
                              <button className={styles.inlineCancelBtn} onClick={() => setEditingItemId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div className={styles.timelineActions}>
                              <button className={styles.itemActionBtn} onClick={() => { setEditingItemId(ep.id); setEditingItemType("episodes"); setEditingItemValue(ep.summary); }} title="Edit Summary">
                                <Pencil size={12} />
                              </button>
                              <button className={styles.itemActionBtn} onClick={() => handleDeleteMemory("episodes", ep.id)} title="Delete Summary" style={{ color: "var(--accent-primary)" }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 3. Behavioral Rules Tab */}
            {activeTab === "rules" && (
              filteredProcedures.length === 0 ? (
                <div className={styles.emptyMemories}>
                  <Settings size={36} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                  <p className={styles.emptyTitle}>No learned rules found</p>
                  <span className={styles.emptyDesc}>Rules are formatting preferences or behavioral constraints learned dynamically from your suggestions.</span>
                </div>
              ) : (
                <div className={styles.rulesGrid}>
                  {filteredProcedures.map((rule) => (
                    <div key={rule.id} className={styles.ruleCard}>
                      <div className={styles.ruleCardHeader}>
                        <div className={styles.ruleIndicator}></div>
                        <span className={styles.ruleSource}>
                          {rule.source_thread_id ? `Source: Thread ${rule.source_thread_id.substring(0, 8)}` : "System Defined"}
                        </span>
                      </div>
                      <div className={styles.ruleCardBody}>
                        {editingItemId === rule.id && editingItemType === "procedures" ? (
                          <textarea
                            className={styles.itemEditTextarea}
                            value={editingItemValue}
                            onChange={(e) => setEditingItemValue(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <p className={styles.ruleText}>{rule.rule}</p>
                        )}
                      </div>
                      <div className={styles.ruleCardFooter}>
                        <span className={styles.ruleDate}>Learned {new Date(rule.created_at).toLocaleDateString()}</span>
                        {editingItemId === rule.id && editingItemType === "procedures" ? (
                          <div className={styles.inlineEditControls}>
                            <button className={styles.inlineSaveBtn} onClick={handleSaveMemoryItem}>Save</button>
                            <button className={styles.inlineCancelBtn} onClick={() => setEditingItemId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className={styles.ruleCardActions}>
                            <button className={styles.itemActionBtn} onClick={() => { setEditingItemId(rule.id); setEditingItemType("procedures"); setEditingItemValue(rule.rule); }} title="Edit Rule">
                              <Pencil size={12} />
                            </button>
                            <button className={styles.itemActionBtn} onClick={() => handleDeleteMemory("procedures", rule.id)} title="Delete Rule">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 4. Semantic Facts Index Tab */}
            {activeTab === "facts" && (
              filteredMemories.length === 0 ? (
                <div className={styles.emptyMemories}>
                  <Sparkles size={36} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                  <p className={styles.emptyTitle}>No matching indexed facts</p>
                  <span className={styles.emptyDesc}>Semantic facts are extracted details that ground conversation routing and personalized suggestions.</span>
                </div>
              ) : (
                <div className={styles.factsList}>
                  {filteredMemories.map((fact) => (
                    <div key={fact.id} className={styles.factItem}>
                      <div className={styles.factBody}>
                        <ChevronRight size={14} className={styles.factChevron} />
                        {editingItemId === fact.id && editingItemType === "facts" ? (
                          <textarea
                            className={styles.itemEditTextarea}
                            value={editingItemValue}
                            onChange={(e) => setEditingItemValue(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className={styles.factText}>{fact.content}</span>
                        )}
                      </div>
                      <div className={styles.factFooter}>
                        <span className={styles.factDate}>Saved {new Date(fact.created_at).toLocaleDateString()}</span>
                        {editingItemId === fact.id && editingItemType === "facts" ? (
                          <div className={styles.inlineEditControls}>
                            <button className={styles.inlineSaveBtn} onClick={handleSaveMemoryItem}>Save</button>
                            <button className={styles.inlineCancelBtn} onClick={() => setEditingItemId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className={styles.factActions}>
                            <button className={styles.itemActionBtn} onClick={() => { setEditingItemId(fact.id); setEditingItemType("facts"); setEditingItemValue(fact.content); }} title="Edit Fact">
                              <Pencil size={12} />
                            </button>
                            <button className={styles.itemActionBtn} onClick={() => handleDeleteMemory("memories", fact.id)} title="Delete Fact">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
