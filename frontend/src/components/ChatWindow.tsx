"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, MessageSquare, Mic, MicOff } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import styles from "./ChatWindow.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: string;
  reasoning?: string;
  routing?: {
    intent: string;
    complexity: string;
    routed_model: string;
  };
  metrics?: {
    model: string;
    complexity: string;
    latency: number;
    tokens: number;
    cost: number;
  };
}

interface ChatWindowProps {
  threadId: string;
  activeUserId: string;
}

const UNIFIED_MODELS = [
  { id: "auto", name: "Auto Mode (Intelligent)", provider: "auto" },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite (Low)", provider: "google" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash (Medium)", provider: "google" },
  { id: "gemini-3.5-flash-high", name: "Gemini 3.5 Flash (High)", provider: "google" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Low)", provider: "google" },
  { id: "gemini-3.1-pro-preview-high", name: "Gemini 3.1 Pro (High)", provider: "google" },
  { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-sonnet-4.7", name: "Claude Sonnet 4.7", provider: "anthropic" },
  { id: "claude-opus-4.6", name: "Claude Opus 4.6", provider: "anthropic" },
  { id: "claude-opus-4.7", name: "Claude Opus 4.7", provider: "anthropic" },
  { id: "claude-opus-4.8", name: "Claude Opus 4.8", provider: "anthropic" },
  { id: "claude-fable-5", name: "Claude Fable 5", provider: "anthropic" },
  { id: "gpt-4.6-omni", name: "GPT 4.6 Omni", provider: "openai" },
  { id: "gpt-5.5-omni", name: "GPT 5.5 Omni", provider: "openai" },
  { id: "gpt-5.6-omni", name: "GPT 5.6 Omni", provider: "openai" },
  { id: "groq-llama-3.3-70b", name: "Llama 3.3 70B", provider: "groq" },
  { id: "groq-llama-3.1-8b", name: "Llama 3.1 8B", provider: "groq" },
  { id: "ollama-qwen2.5-coder-14b", name: "Qwen 2.5 Coder 14B (Local)", provider: "ollama" },
  { id: "ollama-gemma4-e4b", name: "Gemma 4 (Local)", provider: "ollama" }
];

export default function ChatWindow({ threadId, activeUserId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  const [providerAvailability, setProviderAvailability] = useState<Record<string, boolean>>({
    google: true,
    openai: false,
    anthropic: false,
    groq: false,
    ollama: false,
  });
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiBaseUrl}/api/providers/availability`);
        if (res.ok) {
          const data = await res.json();
          setProviderAvailability(data);
        }
      } catch (err) {
        console.error("Failed to fetch provider key availability:", err);
      }
    };
    fetchAvailability();
  }, []);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load previous messages when threadId changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (!threadId) {
        setMessages([]);
        return;
      }
      
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiBaseUrl}/api/threads/${threadId}/messages`);
        if (res.ok) {
          const data = await res.json();
          const uiMessages = data.map((m: any) => ({
            id: `msg-${m.id}`,
            role: m.role,
            content: m.content,
            plan: m.plan,
            reasoning: m.reasoning,
            routing: m.routing,
            metrics: m.metrics
          }));
          setMessages(uiMessages);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to fetch thread messages:", err);
        setMessages([]);
      }
    };
    
    fetchHistory();
  }, [threadId]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return;

    const userMsgId = `msg-${Date.now()}-user`;
    const assistantMsgId = `msg-${Date.now()}-assistant`;

    const userMessage: Message = {
      id: userMsgId,
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Append placeholder for assistant response
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "" },
    ]);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          thread_id: threadId,
          user_id: activeUserId,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status code ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error("Unable to obtain stream reader");
      }

      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; // retain last partial block

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const jsonStr = part.substring(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.type === "token") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + data.content }
                      : msg
                  )
                );
              } else if (data.type === "plan_debug") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, plan: (msg.plan || "") + data.content }
                      : msg
                  )
                );
              } else if (data.type === "reasoning_debug") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, reasoning: (msg.reasoning || "") + data.content }
                      : msg
                  )
                );
              } else if (data.type === "routing_debug") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          routing: {
                            intent: data.content.intent,
                            complexity: data.content.complexity,
                            routed_model: data.content.routed_model
                          }
                        }
                      : msg
                  )
                );
              } else if (data.type === "metrics") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, metrics: data.content }
                      : msg
                  )
                );
              } else if (data.type === "error") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: `Error: ${data.content}` }
                      : msg
                  )
                );
              }
            } catch (jsonErr) {
              console.error("Failed to parse SSE JSON chunk:", jsonErr);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Streaming error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `Backend Connection Offline. Please ensure the Python FastAPI backend is running at http://localhost:8000. (Details: ${error.message})`,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Browser does not support audio recording.");
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop()); // release mic
        await handleTranscribe(audioBlob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start audio recording:", err);
      alert("Microphone access denied or error starting recording.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async (audioBlob: Blob) => {
    setIsStreaming(true);
    setInput("Transcribing voice...");
    
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiBaseUrl}/api/transcribe`, {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Server returned status code ${response.status}`);
      }
      
      const data = await response.json();
      const transcribedText = data.text || "";
      
      if (transcribedText.trim()) {
        setInput(""); // clear transcribing placeholder
        await sendMessage(transcribedText);
      } else {
        setInput("");
        alert("Could not transcribe any speech. Please try speaking closer to the microphone.");
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      setInput("");
      alert(`Transcription failed: ${err.message}`);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className={styles.window}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Assistant Node</h2>
          <span className={styles.subtitle}>Session: {threadId || "Initializing..."}</span>
        </div>
        <div className={styles.badge}>
          <div className={styles.badgeDot}></div>
          <span>LangGraph Engine</span>
        </div>
      </header>

      <div className={styles.messagesArea}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <Sparkles className={styles.emptyIcon} size={48} style={{ color: "var(--accent-secondary)", opacity: 0.8 }} />
            <h3 className={styles.emptyTitle}>Empower Your Data Decisions</h3>
            <p className={styles.emptyDesc}>
              Chat with your dynamic workspace to discover real-time web insights, retrieve knowledge, or analyze database systems.
            </p>
            
            <div className={styles.suggestionsGrid}>
              <div className={styles.suggestionCard} onClick={() => setInput("What are the latest breakthroughs in AI agents?")}>
                <span className={styles.suggestionEmoji}>🔍</span>
                <div className={styles.suggestionContent}>
                  <div className={styles.suggestionTitle}>Web Search</div>
                  <div className={styles.suggestionText}>Look up real-time news and web information</div>
                </div>
              </div>
              <div className={styles.suggestionCard} onClick={() => setInput("What date and time is it today?")}>
                <span className={styles.suggestionEmoji}>📅</span>
                <div className={styles.suggestionContent}>
                  <div className={styles.suggestionTitle}>System Time</div>
                  <div className={styles.suggestionText}>Test dynamic time injection and context</div>
                </div>
              </div>
              <div className={styles.suggestionCard} onClick={() => setInput("How does vector retrieval ground AI answers?")}>
                <span className={styles.suggestionEmoji}>📚</span>
                <div className={styles.suggestionContent}>
                  <div className={styles.suggestionTitle}>Vector Database</div>
                  <div className={styles.suggestionText}>Preview Phase 2 knowledge grounding</div>
                </div>
              </div>
              <div className={styles.suggestionCard} onClick={() => setInput("How will Generative UI help analyze metrics?")}>
                <span className={styles.suggestionEmoji}>📊</span>
                <div className={styles.suggestionContent}>
                  <div className={styles.suggestionTitle}>Database Analytics</div>
                  <div className={styles.suggestionText}>Preview Phase 3 interactive visuals</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.messageRow} ${
                msg.role === "user" ? styles.messageRowUser : styles.messageRowAssistant
              }`}
            >
              <div
                className={`${styles.bubble} ${
                  msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <div className={styles.assistantContainer}>
                    {/* Routing Badge */}
                    {msg.routing && (
                      <div className={styles.routingBadge}>
                        <Sparkles size={10} className={styles.routingIcon} />
                        <span>Routed to <strong>{msg.routing.routed_model}</strong></span>
                        <span className={styles.routingDetail}>
                          &nbsp;({msg.routing.intent} • {msg.routing.complexity})
                        </span>
                      </div>
                    )}

                    {/* Plan Block */}
                    {msg.plan && (
                      <div className={styles.planBlock}>
                        <div className={styles.blockHeader}>📋 Execution Plan</div>
                        <pre className={styles.blockContent}>{msg.plan}</pre>
                      </div>
                    )}

                    {/* Thinking/Reasoning Block */}
                    {msg.reasoning && (
                      <div className={styles.reasoningBlock}>
                        <div className={styles.blockHeader}>🧠 Thinking Process</div>
                        <pre className={styles.blockContent}>{msg.reasoning}</pre>
                      </div>
                    )}

                    {/* Main Content */}
                    {msg.content === "" && !msg.plan && !msg.reasoning && !msg.routing ? (
                      <div className={styles.typingIndicator}>
                        <div className={styles.dot}></div>
                        <div className={styles.dot}></div>
                        <div className={styles.dot}></div>
                      </div>
                    ) : (
                      <div className={styles.mainContent}>
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    )}

                    {/* Metrics Footer */}
                    {msg.metrics && (
                      <div className={styles.metricsFooter}>
                        <span>⚡ {msg.metrics.latency}s</span>
                        <span className={styles.metricsSeparator}>•</span>
                        <span>📝 {msg.metrics.tokens} tokens</span>
                        <span className={styles.metricsSeparator}>•</span>
                        <span>🪙 ${msg.metrics.cost.toFixed(5)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={`${styles.inputArea} ${isFocused ? styles.inputAreaFocused : ""}`}>
        <input
          type="text"
          className={styles.input}
          placeholder={threadId ? "Ask me anything..." : "Initializing session..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={isStreaming || !threadId}
        />
        
        <button
          type="button"
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          className={`${styles.micButton} ${isRecording ? styles.micButtonRecording : ""}`}
          disabled={isStreaming || !threadId}
          title={isRecording ? "Stop recording and transcribe" : "Record voice input"}
        >
          {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <div className={styles.inputModelSelectWrapper}>
          <select
            className={styles.inputModelSelect}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isStreaming || !threadId}
          >
            {UNIFIED_MODELS.map(m => {
              const isConfigured = m.provider === "auto" || providerAvailability[m.provider] !== false;
              const displayName = isConfigured ? m.name : `${m.name} (API key not configured)`;
              return (
                <option key={m.id} value={m.id} disabled={!isConfigured}>
                  {displayName}
                </option>
              );
            })}
          </select>
        </div>

        <button type="submit" className={styles.sendButton} disabled={!input.trim() || isStreaming || !threadId}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
