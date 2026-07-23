"use client";

import React, { useState, useEffect } from "react";
import { 
  DollarSign, TrendingUp, Cpu, BarChart3, Clock, Layers, 
  Users, RefreshCw, Download, Search, ShieldCheck, User, Zap, Sparkles,
  ArrowUpDown, ChevronUp, ChevronDown
} from "lucide-react";
import styles from "./UsageDashboard.module.css";

interface UsageDashboardProps {
  activeUserId: string;
  userRole: string;
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
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
  supports_vision?: boolean;
  supports_reasoning?: boolean;
  supports_tool_calling?: boolean;
  preferred_categories?: string[];
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

  // Sort States for 3 Tables
  const [matrixSort, setMatrixSort] = useState<SortConfig>({ key: "total_requests", direction: "desc" });
  const [personalSort, setPersonalSort] = useState<SortConfig>({ key: "total_requests", direction: "desc" });
  const [catalogSort, setCatalogSort] = useState<SortConfig>({ key: "id", direction: "asc" });

  const handleHeaderClick = (
    key: string,
    currentSort: SortConfig,
    setSort: React.Dispatch<React.SetStateAction<SortConfig>>
  ) => {
    if (currentSort.key === key) {
      setSort({
        key,
        direction: currentSort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSort({ key, direction: "desc" });
    }
  };

  const renderSortHeader = (
    label: string,
    key: string,
    currentSort: SortConfig,
    setSort: React.Dispatch<React.SetStateAction<SortConfig>>
  ) => {
    const isActive = currentSort.key === key;
    return (
      <th 
        className={styles.sortableHeader}
        onClick={() => handleHeaderClick(key, currentSort, setSort)}
        title={`Sort by ${label}`}
      >
        <div className={styles.headerContent}>
          <span>{label}</span>
          {isActive ? (
            currentSort.direction === "asc" ? (
              <ChevronUp size={14} className={`${styles.sortIcon} ${styles.sortIconActive}`} />
            ) : (
              <ChevronDown size={14} className={`${styles.sortIcon} ${styles.sortIconActive}`} />
            )
          ) : (
            <ArrowUpDown size={12} className={styles.sortIcon} />
          )}
        </div>
      </th>
    );
  };

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

  // Sorted matrix
  const sortedMatrix = React.useMemo(() => {
    return [...filteredMatrix].sort((a, b) => {
      let aVal: any = (a as any)[matrixSort.key];
      let bVal: any = (b as any)[matrixSort.key];
      if (aVal === undefined || aVal === null) aVal = "";
      if (bVal === undefined || bVal === null) bVal = "";
      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return matrixSort.direction === "asc" ? cmp : -cmp;
      }
      return matrixSort.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredMatrix, matrixSort]);

  // Sorted personal metrics
  const sortedPersonalMetrics = React.useMemo(() => {
    const metrics: ModelMetric[] = userMetrics?.model_metrics || [];
    return [...metrics].sort((a, b) => {
      let aVal: any = (a as any)[personalSort.key];
      let bVal: any = (b as any)[personalSort.key];
      if (aVal === undefined || aVal === null) aVal = "";
      if (bVal === undefined || bVal === null) bVal = "";
      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return personalSort.direction === "asc" ? cmp : -cmp;
      }
      return personalSort.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [userMetrics?.model_metrics, personalSort]);

  // Sorted catalog models
  const sortedCatalog = React.useMemo(() => {
    return [...registeredModels].sort((a, b) => {
      let aVal: any = (a as any)[catalogSort.key];
      let bVal: any = (b as any)[catalogSort.key];
      if (aVal === undefined || aVal === null) aVal = "";
      if (bVal === undefined || bVal === null) bVal = "";
      if (typeof aVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return catalogSort.direction === "asc" ? cmp : -cmp;
      }
      return catalogSort.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [registeredModels, catalogSort]);

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

      {/* Tabs Container */}
      <div className={styles.tabsContainer}>
        {userRole === "admin" && (
          <button 
            className={`${styles.tabButton} ${activeTab === "matrix" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("matrix")}
          >
            <Users size={16} />
            <span>Per User Per Model Matrix</span>
          </button>
        )}
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
          <Sparkles size={16} />
          <span>Available Model Catalog</span>
        </button>
      </div>

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
                  {renderSortHeader("User", "username", matrixSort, setMatrixSort)}
                  {renderSortHeader("Model", "model_id", matrixSort, setMatrixSort)}
                  {renderSortHeader("Provider", "provider", matrixSort, setMatrixSort)}
                  {renderSortHeader("LLM Requests", "total_requests", matrixSort, setMatrixSort)}
                  <th>Complexity Breakdown</th>
                  {renderSortHeader("Prompt Tokens", "prompt_tokens", matrixSort, setMatrixSort)}
                  {renderSortHeader("Completion Tokens", "completion_tokens", matrixSort, setMatrixSort)}
                  {renderSortHeader("Avg Latency", "avg_latency", matrixSort, setMatrixSort)}
                  {renderSortHeader("Total Cost ($)", "total_cost_usd", matrixSort, setMatrixSort)}
                </tr>
              </thead>
              <tbody>
                {sortedMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "2rem" }}>
                      No metrics records found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  sortedMatrix.map((item, idx) => (
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
                  {renderSortHeader("Model", "model_id", personalSort, setPersonalSort)}
                  {renderSortHeader("Provider", "provider", personalSort, setPersonalSort)}
                  {renderSortHeader("Total Requests", "total_requests", personalSort, setPersonalSort)}
                  <th>Complexity Types</th>
                  {renderSortHeader("Prompt Tokens", "prompt_tokens", personalSort, setPersonalSort)}
                  {renderSortHeader("Completion Tokens", "completion_tokens", personalSort, setPersonalSort)}
                  {renderSortHeader("Avg Latency", "avg_latency", personalSort, setPersonalSort)}
                  {renderSortHeader("Total Cost ($)", "total_cost_usd", personalSort, setPersonalSort)}
                </tr>
              </thead>
              <tbody>
                {sortedPersonalMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                      No personal usage records recorded yet. Start a chat session to generate usage metrics.
                    </td>
                  </tr>
                ) : (
                  sortedPersonalMetrics.map((m: ModelMetric) => (
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

      {/* Available Model Catalog & Details (Tab 3) */}
      {(activeTab === "models" || registeredModels.length > 0) && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Sparkles size={18} color="#c084fc" />
              Available Model Catalog & Details
            </h3>
            <span className={styles.cardSubtext}>
              Compare context limits, reasoning capacity, capabilities, recommended use cases, and token rates to select the optimal model for your tasks.
            </span>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  {renderSortHeader("Model ID", "id", catalogSort, setCatalogSort)}
                  {renderSortHeader("Provider", "provider", catalogSort, setCatalogSort)}
                  <th>Capabilities</th>
                  <th>Best Use Cases</th>
                  {renderSortHeader("Context Window", "context_window", catalogSort, setCatalogSort)}
                  {renderSortHeader("Quality Score", "quality_score", catalogSort, setCatalogSort)}
                  {renderSortHeader("Input Cost / 1M", "input_cost_per_m", catalogSort, setCatalogSort)}
                  {renderSortHeader("Output Cost / 1M", "output_cost_per_m", catalogSort, setCatalogSort)}
                </tr>
              </thead>
              <tbody>
                {sortedCatalog.map((reg) => (
                  <tr key={reg.id}>
                    <td>
                      <span className={styles.modelBadge}>
                        <Cpu size={12} />
                        {reg.id}
                      </span>
                    </td>
                    <td style={{ textTransform: "capitalize", color: "#94a3b8" }}>{reg.provider}</td>
                    <td>
                      <div className={styles.capabilitiesWrapper}>
                        {reg.supports_vision && <span className={`${styles.badgeCap} ${styles.badgeVision}`}>Vision</span>}
                        {reg.supports_reasoning && <span className={`${styles.badgeCap} ${styles.badgeReasoning}`}>Reasoning</span>}
                        {reg.supports_tool_calling && <span className={`${styles.badgeCap} ${styles.badgeTools}`}>Tools</span>}
                      </div>
                    </td>
                    <td>
                      <div className={styles.categoriesWrapper}>
                        {reg.preferred_categories && reg.preferred_categories.length > 0 ? (
                          reg.preferred_categories.slice(0, 3).map((cat) => (
                            <span key={cat} className={styles.categoryChip}>
                              {cat.replace("_", " ")}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "0.75rem" }}>General</span>
                        )}
                      </div>
                    </td>
                    <td>{reg.context_window?.toLocaleString()} tokens</td>
                    <td>{(reg.quality_score * 100).toFixed(0)}%</td>
                    <td style={{ color: "#34d399", fontWeight: 600 }}>${reg.input_cost_per_m?.toFixed(4)}</td>
                    <td style={{ color: "#34d399", fontWeight: 600 }}>${reg.output_cost_per_m?.toFixed(4)}</td>
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
