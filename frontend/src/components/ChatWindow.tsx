"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, MessageSquare } from "lucide-react";
import styles from "./ChatWindow.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatWindowProps {
  threadId: string;
}

const UNIFIED_MODELS = [
  { id: "auto", name: "Auto Mode (Intelligent)" },
  { id: "gemini-3.5-flash-low", name: "Gemini 3.5 Flash (Low)" },
  { id: "gemini-3.5-flash-medium", name: "Gemini 3.5 Flash (Medium)" },
  { id: "gemini-3.5-flash-high", name: "Gemini 3.5 Flash (High)" },
  { id: "gemini-3.1-pro-low", name: "Gemini 3.1 Pro (Low)" },
  { id: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro (High)" },
  { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6 (Requires API Key)" },
  { id: "claude-sonnet-4.7", name: "Claude Sonnet 4.7 (Requires API Key)" },
  { id: "claude-opus-4.6", name: "Claude Opus 4.6 (Requires API Key)" },
  { id: "claude-opus-4.7", name: "Claude Opus 4.7 (Requires API Key)" },
  { id: "claude-opus-4.8", name: "Claude Opus 4.8 (Requires API Key)" },
  { id: "claude-fable-5", name: "Claude Fable 5 (Requires API Key)" },
  { id: "gpt-4.6-omni", name: "GPT 4.6 Omni (Requires API Key)" },
  { id: "gpt-5.5-omni", name: "GPT 5.5 Omni (Requires API Key)" },
  { id: "gpt-5.6-omni", name: "GPT 5.6 Omni (Requires API Key)" },
  { id: "groq-llama-3.3-70b", name: "Llama 3.3 70B (Groq)" },
  { id: "groq-llama-3.1-8b", name: "Llama 3.1 8B (Groq)" }
];

export default function ChatWindow({ threadId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const [selectedModel, setSelectedModel] = useState<string>("auto");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset messages when threadId changes
  useEffect(() => {
    setMessages([]);
  }, [threadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessageContent = input.trim();
    const userMsgId = `msg-${Date.now()}-user`;
    const assistantMsgId = `msg-${Date.now()}-assistant`;

    const userMessage: Message = {
      id: userMsgId,
      role: "user",
      content: userMessageContent,
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
          message: userMessageContent,
          thread_id: threadId,
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
                {msg.role === "assistant" && msg.content === "" ? (
                  <div className={styles.typingIndicator}>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                    <div className={styles.dot}></div>
                  </div>
                ) : (
                  msg.content
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
        
        <div className={styles.inputModelSelectWrapper}>
          <select
            className={styles.inputModelSelect}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isStreaming || !threadId}
          >
            {UNIFIED_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <button type="submit" className={styles.sendButton} disabled={!input.trim() || isStreaming || !threadId}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
