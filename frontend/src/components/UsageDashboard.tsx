"use client";

import React, { useState, useEffect } from "react";
import { 
  DollarSign, TrendingUp, Cpu, BarChart3, Clock, Layers, 
  Users, RefreshCw, Download, Search, ShieldCheck, User, Zap, Sparkles 
} from "lucide-react";
import styles from "./UsageDashboard.module.css";

interface UsageDashboardProps {
  activeUserId: string;
  userRole: string;
}

interface ModelMetric {
  model_id: string;
  model_name: string;
  provider: string;
  total_requests: number;
  total_cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  avg_latency?: number;
  complexity_breakdown: Record<string, number>;
}

interface UserModelMatrixItem extends ModelMetric {
  user_id: string;
  username: string;
}

interface UserSummary {
  user_id: string;
  username: string;
  total_requests: number;
  total_cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  complexity_breakdown: Record<string, number>;
}

interface RegisteredModel {
  id: string;
  provider: string;
  model_name: string;
  context_window: number;
  quality_score: number;
  input_cost_per_m: number;
  output_cost_per_m: number;
}

export default function UsageDashboard({ activeUserId, userRole }: UsageDashboardProps) {
  const [timeframe, setTimeframe] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [activeTab, setActiveTab] = useState<"personal" | "matrix" | "models">(
    userRole === "admin" ? "matrix" : "personal"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);

  // User metrics data
  const [userMetrics, setUserMetrics] = useState<any>(null);
  // Admin metrics data
  const [adminMetrics, setAdminMetrics] = useState<any>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      let queryParams = `timeframe=${timeframe}`;
      if (timeframe === "custom") {
        if (startDate) queryParams += `&start_date=${startDate}`;
        if (endDate) queryParams += `&end_date=${endDate}`;
      }

      if (userRole === "admin") {
        const adminRes = await fetch(`${apiBaseUrl}/api/admin/usage-metrics?${queryParams}`);
        if (adminRes.ok) {
          const data = await adminRes.json();
          setAdminMetrics(data);
        }
      }

      if (activeUserId) {
        const userRes = await fetch(`${apiBaseUrl}/api/users/${activeUserId}/usage-metrics?${queryParams}`);
        if (userRes.ok) {
          const data = await userRes.json();
          setUserMetrics(data);
        }
      }
    } catch (err) {
      console.error("Error fetching usage metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [activeUserId, userRole, timeframe, startDate, endDate]);

  // Registered models list from API response
  const registeredModels: RegisteredModel[] = (
    adminMetrics?.registered_models || userMetrics?.registered_models || []
  );

  // Export report as JSON file
  const handleExportJSON = () => {
    const dataToExport = activeTab === "matrix" || userRole === "admin" ? adminMetrics : userMetrics;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `llm_usage_report_${timeframe}_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export matrix table as CSV
  const handleExportCSV = () => {
    const matrix: UserModelMatrixItem[] = adminMetrics?.user_model_matrix || [];
    if (matrix.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,User,Model,Provider,Requests,Simple_Reqs,Medium_Reqs,Complex_Reqs,Prompt_Tokens,Completion_Tokens,Avg_Latency_s,Total_Cost_USD\n";
    matrix.forEach((item) => {
      const simple = item.complexity_breakdown?.simple || 0;
      const medium = item.complexity_breakdown?.medium || 0;
      const complex = item.complexity_breakdown?.complex || 0;
      csvContent += `"${item.username}","${item.model_id}","${item.provider}",${item.total_requests},${simple},${medium},${complex},${item.prompt_tokens},${item.completion_tokens},${item.avg_latency || 0},${item.total_cost_usd}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `user_model_matrix_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Filter matrix items
  const rawMatrix: UserModelMatrixItem[] = adminMetrics?.user_model_matrix || [];
  const filteredMatrix = rawMatrix.filter((item) => {
    const matchesSearch = 
      item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.provider.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesModel = selectedModelFilter === "all" || item.model_id === selectedModelFilter;
    return matchesSearch && matchesModel;
  });

  // Active summary numbers
  const currentSummary = activeTab === "matrix" && adminMetrics 
    ? adminMetrics.summary 
    : userMetrics?.summary || { total_cost_usd: 0, total_requests: 0, total_tokens: 0, avg_latency_seconds: 0 };

  const currentComplexitySummary = activeTab === "matrix" && adminMetrics
    ? (adminMetrics.models_summary || []).reduce((acc: any, m: any) => {
        Object.entries(m.complexity_breakdown || {}).forEach(([k, v]) => {
          acc[k] = (acc[k] || 0) + (v as number);
        });
        return acc;
      }, {})
    : userMetrics?.complexity_summary || {};

  const totalReqs = currentSummary.total_requests || 1;
  const simpleCount = currentComplexitySummary.simple || 0;
  const mediumCount = currentComplexitySummary.medium || 0;
  const complexCount = currentComplexitySummary.complex || 0;

  return (
    <div className={styles.dashboardContainer}>
      {/* Top Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <TrendingUp size={24} color="#3b82f6" />
            <h2 className={styles.title}>Usage & Cost Dashboard</h2>
            <span className={`${styles.roleBadge} ${userRole === "admin" ? styles.adminBadge : styles.userBadge}`}>
              {userRole === "admin" ? <ShieldCheck size={13} /> : <User size={13} />}
              {userRole === "admin" ? "Admin Mode" : "User Mode"}
            </span>
          </div>
          <p className={styles.subtitle}>
            Real-time analytics for LLM request counts, complexity breakdowns, and model token costs per user.
          </p>
        </div>

        {/* Header Controls */}
        <div className={styles.controlsGroup}>
          <select 
            className={styles.selectInput} 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {timeframe === "custom" && (
            <div className={styles.datePickerWrapper}>
              <span className={styles.datePickerLabel}>From:</span>
              <input
                type="date"
                className={styles.dateInput}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className={styles.datePickerLabel}>To:</span>
              <input
                type="date"
                className={styles.dateInput}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}

          {registeredModels.length > 0 && (
            <select
              className={styles.selectInput}
              value={selectedModelFilter}
              onChange={(e) => setSelectedModelFilter(e.target.value)}
            >
              <option value="all">All Models ({registeredModels.length})</option>
              {registeredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} ({m.provider})
                </option>
              ))}
            </select>
          )}

          <button className={styles.actionBtn} onClick={fetchMetrics} title="Refresh metrics">
            <RefreshCw size={14} className={loading ? styles.spinner : ""} />
            <span>Refresh</span>
          </button>

          <button className={styles.actionBtn} onClick={handleExportJSON} title="Export JSON">
            <Download size={14} />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Tabs if Admin */}
      {userRole === "admin" && (
        <div className={styles.tabsContainer}>
          <button 
            className={`${styles.tabButton} ${activeTab === "matrix" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("matrix")}
          >
            <Users size={16} />
            <span>Per User Per Model Matrix</span>
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === "personal" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("personal")}
          >
            <User size={16} />
            <span>My Personal Usage</span>
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === "models" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("models")}
          >
            <Cpu size={16} />
            <span>Dynamic Models Registry</span>
          </button>
        </div>
      )}

      {/* Top Overview KPI Cards */}
      <div className={styles.cardsGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Total Cost</span>
            <div className={styles.cardIconWrapper} style={{ background: "rgba(52, 211, 153, 0.15)", color: "#34d399" }}>
              <DollarSign size={18} />
            </div>
          </div>
          <span className={styles.cardValue}>${currentSummary.total_cost_usd?.toFixed(6) || "0.000000"}</span>
          <span className={styles.cardSubtext}>Calculated LLM token consumption expenditure</span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Total LLM Requests</span>
            <div className={styles.cardIconWrapper} style={{ background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
              <BarChart3 size={18} />
            </div>
          </div>
          <span className={styles.cardValue}>{currentSummary.total_requests || 0}</span>
          <span className={styles.cardSubtext}>Inferences processed across models</span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Total Tokens</span>
            <div className={styles.cardIconWrapper} style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
              <Layers size={18} />
            </div>
          </div>
          <span className={styles.cardValue}>{(currentSummary.total_tokens || 0).toLocaleString()}</span>
          <span className={styles.cardSubtext}>
            In: {(currentSummary.prompt_tokens || 0).toLocaleString()} | Out: {(currentSummary.completion_tokens || 0).toLocaleString()}
          </span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Avg Latency</span>
            <div className={styles.cardIconWrapper} style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
              <Clock size={18} />
            </div>
          </div>
          <span className={styles.cardValue}>{currentSummary.avg_latency_seconds || 0}s</span>
          <span className={styles.cardSubtext}>Average response time per inference</span>
        </div>
      </div>

      {/* Complexity Breakdown Section */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <Zap size={18} color="#f59e0b" />
            Request Complexity Distribution
          </h3>
        </div>

        <div className={styles.complexityGrid}>
          <div className={`${styles.complexityCard} ${styles.compSimple}`}>
            <div className={styles.compHeader}>
              <span className={styles.compTitle}>Simple Requests</span>
              <span className={styles.chipSimple}>Simple</span>
            </div>
            <span className={styles.compCount}>{simpleCount}</span>
            <div className={styles.progressBarTrack}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${Math.round((simpleCount / totalReqs) * 100)}%`, background: "#10b981" }}
              />
            </div>
            <span className={styles.cardSubtext}>{Math.round((simpleCount / totalReqs) * 100)}% of total queries</span>
          </div>

          <div className={`${styles.complexityCard} ${styles.compMedium}`}>
            <div className={styles.compHeader}>
              <span className={styles.compTitle}>Medium Requests</span>
              <span className={styles.chipMedium}>Medium</span>
            </div>
            <span className={styles.compCount}>{mediumCount}</span>
            <div className={styles.progressBarTrack}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${Math.round((mediumCount / totalReqs) * 100)}%`, background: "#f59e0b" }}
              />
            </div>
            <span className={styles.cardSubtext}>{Math.round((mediumCount / totalReqs) * 100)}% of total queries</span>
          </div>

          <div className={`${styles.complexityCard} ${styles.compComplex}`}>
            <div className={styles.compHeader}>
              <span className={styles.compTitle}>Complex Requests</span>
              <span className={styles.chipComplex}>Complex</span>
            </div>
            <span className={styles.compCount}>{complexCount}</span>
            <div className={styles.progressBarTrack}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${Math.round((complexCount / totalReqs) * 100)}%`, background: "#ef4444" }}
              />
            </div>
            <span className={styles.cardSubtext}>{Math.round((complexCount / totalReqs) * 100)}% of total queries</span>
          </div>
        </div>
      </div>

      {/* Main Data Section (Tab 1: Per User Per Model Matrix / Admin Table) */}
      {(activeTab === "matrix" || userRole === "admin") && activeTab !== "personal" && activeTab !== "models" && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Users size={18} color="#60a5fa" />
              Per User Per Model Metrics Matrix
            </h3>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <div className={styles.searchBox}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search user or model..."
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className={styles.actionBtn} onClick={handleExportCSV}>
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>LLM Requests</th>
                  <th>Complexity Breakdown</th>
                  <th>Prompt Tokens</th>
                  <th>Completion Tokens</th>
                  <th>Avg Latency</th>
                  <th>Total Cost ($)</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "2rem" }}>
                      No metrics records found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredMatrix.map((item, idx) => (
                    <tr key={`${item.user_id}-${item.model_id}-${idx}`}>
                      <td>
                        <span className={styles.userChip}>
                          <User size={12} />
                          {item.username || item.user_id}
                        </span>
                      </td>
                      <td>
                        <span className={styles.modelBadge}>
                          <Cpu size={12} />
                          {item.model_id}
                        </span>
                      </td>
                      <td style={{ textTransform: "capitalize", fontWeight: 500, color: "#94a3b8" }}>
                        {item.provider}
                      </td>
                      <td style={{ fontWeight: 700 }}>{item.total_requests}</td>
                      <td>
                        <div className={styles.complexityChips}>
                          <span className={styles.chipSimple}>S: {item.complexity_breakdown?.simple || 0}</span>
                          <span className={styles.chipMedium}>M: {item.complexity_breakdown?.medium || 0}</span>
                          <span className={styles.chipComplex}>C: {item.complexity_breakdown?.complex || 0}</span>
                        </div>
                      </td>
                      <td>{(item.prompt_tokens || 0).toLocaleString()}</td>
                      <td>{(item.completion_tokens || 0).toLocaleString()}</td>
                      <td>{item.avg_latency ? `${item.avg_latency}s` : "0.0s"}</td>
                      <td className={styles.costText}>${item.total_cost_usd.toFixed(6)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Personal Model Breakdown Table (Tab 2 or User View) */}
      {(activeTab === "personal" || userRole !== "admin") && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Cpu size={18} color="#60a5fa" />
              My Model Breakdown & Costs
            </h3>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Total Requests</th>
                  <th>Complexity Types</th>
                  <th>Prompt Tokens</th>
                  <th>Completion Tokens</th>
                  <th>Avg Latency</th>
                  <th>Total Cost ($)</th>
                </tr>
              </thead>
              <tbody>
                {!userMetrics?.model_metrics || userMetrics.model_metrics.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                      No personal usage records recorded yet. Start a chat session to generate usage metrics.
                    </td>
                  </tr>
                ) : (
                  userMetrics.model_metrics.map((m: ModelMetric) => (
                    <tr key={m.model_id}>
                      <td>
                        <span className={styles.modelBadge}>
                          <Cpu size={12} />
                          {m.model_id}
                        </span>
                      </td>
                      <td style={{ textTransform: "capitalize", color: "#94a3b8" }}>{m.provider}</td>
                      <td style={{ fontWeight: 700 }}>{m.total_requests}</td>
                      <td>
                        <div className={styles.complexityChips}>
                          <span className={styles.chipSimple}>Simple: {m.complexity_breakdown?.simple || 0}</span>
                          <span className={styles.chipMedium}>Medium: {m.complexity_breakdown?.medium || 0}</span>
                          <span className={styles.chipComplex}>Complex: {m.complexity_breakdown?.complex || 0}</span>
                        </div>
                      </td>
                      <td>{(m.prompt_tokens || 0).toLocaleString()}</td>
                      <td>{(m.completion_tokens || 0).toLocaleString()}</td>
                      <td>{m.avg_latency ? `${m.avg_latency}s` : "0.0s"}</td>
                      <td className={styles.costText}>${m.total_cost_usd.toFixed(6)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dynamic Registered Models & Rates (Tab 3) */}
      {(activeTab === "models" || registeredModels.length > 0) && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Sparkles size={18} color="#c084fc" />
              Dynamic Model Registry & Token Pricing
            </h3>
            <span className={styles.cardSubtext}>
              Any new model added to ModelRegistry automatically populates here.
            </span>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Model ID</th>
                  <th>Provider</th>
                  <th>Context Window</th>
                  <th>Quality Score</th>
                  <th>Input Cost / 1M Tokens</th>
                  <th>Output Cost / 1M Tokens</th>
                </tr>
              </thead>
              <tbody>
                {registeredModels.map((reg) => (
                  <tr key={reg.id}>
                    <td>
                      <span className={styles.modelBadge}>
                        <Cpu size={12} />
                        {reg.id}
                      </span>
                    </td>
                    <td style={{ textTransform: "capitalize", color: "#94a3b8" }}>{reg.provider}</td>
                    <td>{reg.context_window?.toLocaleString()} tokens</td>
                    <td>{(reg.quality_score * 100).toFixed(0)}%</td>
                    <td style={{ color: "#34d399" }}>${reg.input_cost_per_m?.toFixed(4)}</td>
                    <td style={{ color: "#34d399" }}>${reg.output_cost_per_m?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
