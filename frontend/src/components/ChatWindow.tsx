"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Send, Sparkles, MessageSquare, Mic, MicOff, Paperclip, 
  Plus, Image as ImageIcon, Video, Music, FileText, 
  ChevronDown, ChevronUp, Cpu, Layers, Activity, Calendar, Search
} from "lucide-react";
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
  activeUsername: string;
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

export default function ChatWindow({ threadId, activeUserId, activeUsername }: ChatWindowProps) {
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollBehaviorRef = useRef<ScrollBehavior>("auto");

  const [attachedFile, setAttachedFile] = useState<{ filename: string; content: string } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Accordion state for collapsed intermediate thoughts
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  // Buffer for smooth streaming
  const streamBufferRef = useRef<string>("");
  const isTypingRef = useRef<boolean>(false);
  const activeMessageIdRef = useRef<string | null>(null);

  const processStreamBuffer = () => {
    if (streamBufferRef.current.length > 0 && activeMessageIdRef.current) {
      const charsToTake = Math.max(1, Math.floor(streamBufferRef.current.length / 8));
      const chunk = streamBufferRef.current.substring(0, charsToTake);
      streamBufferRef.current = streamBufferRef.current.substring(charsToTake);
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === activeMessageIdRef.current
            ? { ...msg, content: msg.content + chunk }
            : msg
        )
      );
      
      setTimeout(processStreamBuffer, 16);
    } else {
      isTypingRef.current = false;
    }
  };

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
    messagesEndRef.current?.scrollIntoView({ behavior: scrollBehaviorRef.current });
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
          scrollBehaviorRef.current = "auto";
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

  const toggleThought = (msgId: string) => {
    setExpandedThoughts(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const getGreeting = () => {
    const hr = new Date().getHours();
    const name = activeUsername || "Atul";
    if (hr < 12) return `Good morning, ${name}`;
    if (hr < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return;

    setIsStreaming(true);
    scrollBehaviorRef.current = "smooth";
    const userMsgId = `msg-${Date.now()}`;
    const assistantMsgId = `msg-${Date.now() + 1}`;

    let fullUserContent = messageText;
    if (attachedFile) {
      fullUserContent = `<details>\n<summary>📎 Attached File: ${attachedFile.filename}</summary>\n\n${attachedFile.content}\n</details>\n\n${messageText}`;
    }

    const userMessage: Message = { id: userMsgId, role: "user", content: fullUserContent };
    
    setMessages((prev) => [...prev, userMessage]);
    
    const currentAttachment = attachedFile;
    setAttachedFile(null);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsStreaming(true);

    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "" },
    ]);

    streamBufferRef.current = "";
    activeMessageIdRef.current = assistantMsgId;
    isTypingRef.current = false;

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
          model: selectedModel === "auto" ? undefined : selectedModel,
          attached_context: currentAttachment?.content || undefined
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
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const jsonStr = part.substring(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.type === "token") {
                streamBufferRef.current += data.content;
                if (!isTypingRef.current) {
                  isTypingRef.current = true;
                  processStreamBuffer();
                }
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
        stream.getTracks().forEach((track) => track.stop());
        try {
          await handleTranscribe(audioBlob);
        } catch (err) {
          console.error("Transcribe API error:", err);
        }
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
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
        setInput("");
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/', 'video/', 'audio/'];
    if (!allowedTypes.some(t => file.type.startsWith(t) || file.type === t)) {
      alert("Unsupported file type. Please upload a PDF, image, video, or audio file.");
      return;
    }

    setAttachedFile(null);
    setIsUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiBaseUrl}/api/upload-file`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setAttachedFile({ filename: data.filename, content: data.content });
      } else {
        const errData = await response.json().catch(() => null);
        alert(`Failed to upload file: ${errData?.detail || response.statusText}`);
      }
    } catch (err) {
      console.error("File upload error:", err);
      alert("Error uploading file.");
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const renderUserMessage = (content: string) => {
    const detailsRegex = /<details>[\s\S]*?<summary>(.*?)<\/summary>[\s\S]*?<\/details>\s*/i;
    const match = content.match(detailsRegex);
    
    if (match) {
      const summary = match[1];
      const filename = summary.replace('📎 Attached File:', '').replace('📎 Attached Document', '').trim();
      const textContent = content.replace(detailsRegex, '').trim();
      
      let FileIcon = Paperclip;
      const lowerFile = filename.toLowerCase();
      if (lowerFile.endsWith('.png') || lowerFile.endsWith('.jpg') || lowerFile.endsWith('.jpeg') || lowerFile.endsWith('.webp')) FileIcon = ImageIcon;
      else if (lowerFile.endsWith('.mp4') || lowerFile.endsWith('.webm') || lowerFile.endsWith('.mov')) FileIcon = Video;
      else if (lowerFile.endsWith('.mp3') || lowerFile.endsWith('.wav') || lowerFile.endsWith('.ogg')) FileIcon = Music;
      else if (lowerFile.endsWith('.pdf')) FileIcon = FileText;
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.attachedFileBadge}>
            <FileIcon size={12} />
            <span>{filename || 'Attached File'}</span>
          </div>
          <div className={styles.userTextContent}>{textContent}</div>
        </div>
      );
    }
    return <div className={styles.userTextContent}>{content}</div>;
  };

  return (
    <div className={styles.window}>
      {/* Redesigned Minimalist Top Bar */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>SAGE Chat Workspace</h2>
          <span className={styles.subtitle}>Active Session ID: {threadId || "Initializing..."}</span>
        </div>
        <div className={styles.badge}>
          <div className={styles.badgeDot}></div>
          <span>LangGraph Engine Grounded</span>
        </div>
      </header>

      {/* Dynamic Main Layout */}
      <div className={`${styles.mainLayout} ${messages.length === 0 ? styles.layoutEmpty : styles.layoutActive}`}>
        
        {/* Messages and Empty State */}
        <div className={styles.messagesContainer}>
          <div className={styles.messagesArea}>
            {messages.length === 0 ? (
              <div className={styles.dashboardContainer}>
                
                {/* 1. Welcoming Personal Header */}
                <div className={styles.dashboardHeader}>
                  <Sparkles className={styles.dashboardSparkleIcon} size={28} />
                  <h2 className={styles.dashboardGreeting}>{getGreeting()}</h2>
                  <p className={styles.dashboardSubtitle}>How can SAGE assist your analytical workflow today?</p>
                </div>

                {/* 2. Three-column SAGE Engine Status Grid */}
                <div className={styles.engineStatusGrid}>
                  <div className={styles.statusCard}>
                    <Cpu size={16} className={styles.statusIcon} style={{ color: "#3b82f6" }} />
                    <div className={styles.statusText}>
                      <span className={styles.statusTitle}>Auto Routing</span>
                      <span className={styles.statusDesc}>Task intent & complexity analysis.</span>
                    </div>
                  </div>
                  <div className={styles.statusCard}>
                    <Layers size={16} className={styles.statusIcon} style={{ color: "#06b6d4" }} />
                    <div className={styles.statusText}>
                      <span className={styles.statusTitle}>Cognitive Memory</span>
                      <span className={styles.statusDesc}>Active facts & preference rules alignment.</span>
                    </div>
                  </div>
                  <div className={styles.statusCard}>
                    <Activity size={16} className={styles.statusIcon} style={{ color: "#10b981" }} />
                    <div className={styles.statusText}>
                      <span className={styles.statusTitle}>Integrations</span>
                      <span className={styles.statusDesc}>Connected catalog & filesystem schemas.</span>
                    </div>
                  </div>
                </div>

                {/* 3. Refined Suggestion Tiles */}
                <div className={styles.suggestionsGrid}>
                  <div className={styles.suggestionTile} onClick={() => setInput("Search for recent advancements in AI agents")}>
                    <Search size={14} className={styles.tileIcon} />
                    <div className={styles.tileContent}>
                      <span className={styles.tileTitle}>Web Search Ingestion</span>
                      <span className={styles.tileText}>Consult internet indices for updated insights.</span>
                    </div>
                  </div>

                  <div className={styles.suggestionTile} onClick={() => setInput("What date and time is it right now?")}>
                    <Calendar size={14} className={styles.tileIcon} />
                    <div className={styles.tileContent}>
                      <span className={styles.tileTitle}>Test Context Ingestion</span>
                      <span className={styles.tileText}>Verify dynamic system date/time variables injection.</span>
                    </div>
                  </div>

                  <div className={styles.suggestionTile} onClick={() => setInput("What rules do you have in your behavioral memory about me?")}>
                    <Layers size={14} className={styles.tileIcon} />
                    <div className={styles.tileContent}>
                      <span className={styles.tileTitle}>Inspect Learned Preferences</span>
                      <span className={styles.tileText}>Query SAGE's behavioral rules memory buffer.</span>
                    </div>
                  </div>

                  <div className={styles.suggestionTile} onClick={() => setInput("Analyze the database analytics mock capabilities")}>
                    <FileText size={14} className={styles.tileIcon} />
                    <div className={styles.tileContent}>
                      <span className={styles.tileTitle}>Database Analysis Preview</span>
                      <span className={styles.tileText}>Review structured querying capabilities.</span>
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
                      renderUserMessage(msg.content)
                    ) : (
                      <div className={styles.assistantContainer}>
                        
                        {/* Accordion Collapsible Process Steps */}
                        {(msg.plan || msg.reasoning || msg.routing || msg.metrics) && (
                          <div className={styles.thoughtAccordion}>
                            <button 
                              type="button" 
                              onClick={() => toggleThought(msg.id)} 
                              className={styles.thoughtAccordionTrigger}
                            >
                              <div className={styles.thoughtAccordionSummary}>
                                <Sparkles size={11} className={styles.thoughtSparkle} />
                                <span>
                                  {msg.routing ? `Grounded via ${msg.routing.routed_model}` : "Cognitive Execution process"}
                                </span>
                                {msg.metrics && (
                                  <span className={styles.thoughtDurationLabel}>
                                    • {msg.metrics.latency.toFixed(2)}s
                                  </span>
                                )}
                              </div>
                              {expandedThoughts[msg.id] ? (
                                <ChevronUp size={14} className={styles.thoughtChevron} />
                              ) : (
                                <ChevronDown size={14} className={styles.thoughtChevron} />
                              )}
                            </button>

                            {expandedThoughts[msg.id] && (
                              <div className={styles.thoughtAccordionContent}>
                                {msg.routing && (
                                  <div className={styles.thoughtSubSection}>
                                    <span className={styles.subSectionTitle}>Routing Analytics</span>
                                    <div className={styles.routingDetailsGrid}>
                                      <span><strong>Intent category:</strong> {msg.routing.intent}</span>
                                      <span><strong>Request complexity:</strong> {msg.routing.complexity}</span>
                                    </div>
                                  </div>
                                )}

                                {msg.plan && (
                                  <div className={styles.thoughtSubSection}>
                                    <span className={styles.subSectionTitle}>Execution Plan</span>
                                    <pre className={styles.rawThoughtBlock}>{msg.plan}</pre>
                                  </div>
                                )}

                                {msg.reasoning && (
                                  <div className={styles.thoughtSubSection}>
                                    <span className={styles.subSectionTitle}>Thinking Process</span>
                                    <pre className={styles.rawThoughtBlock}>{msg.reasoning}</pre>
                                  </div>
                                )}

                                {msg.metrics && (
                                  <div className={styles.thoughtSubSection} style={{ border: "none", paddingBottom: 0 }}>
                                    <span className={styles.subSectionTitle}>Resource Cost Analysis</span>
                                    <div className={styles.routingDetailsGrid}>
                                      <span>Latency: {msg.metrics.latency}s</span>
                                      <span>Tokens generated: {msg.metrics.tokens}</span>
                                      <span>Execution cost: ${msg.metrics.cost.toFixed(6)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Main Response text */}
                        {msg.content === "" && !msg.plan && !msg.reasoning && !msg.routing ? (
                          <div className={styles.typingIndicator}>
                            <div className={styles.dot}></div>
                            <div className={styles.dot}></div>
                            <div className={styles.dot}></div>
                          </div>
                        ) : (
                          <div className={styles.assistantTextBody}>
                            <MarkdownRenderer content={msg.content} />
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
        </div>

        {/* Floating Composer Capsule */}
        <div className={styles.composerContainer}>
          {attachedFile && !isUploadingFile && (
            <div className={styles.attachmentBadge}>
              <Paperclip size={11} /> 
              <span className={styles.attachmentText}>{attachedFile.filename}</span>
              <button type="button" onClick={() => setAttachedFile(null)} className={styles.attachmentRemove}>✕</button>
            </div>
          )}
          {isUploadingFile && (
            <div className={styles.attachmentBadge}>
              <div className={styles.badgeMiniSpinner}></div>
              <span className={styles.attachmentText}>Processing document context...</span>
            </div>
          )}

          {isRecording && (
            <div className={styles.waveOverlay}>
              <div className={styles.waveBar}></div>
              <div className={styles.waveBar}></div>
              <div className={styles.waveBar}></div>
              <div className={styles.waveBar}></div>
              <div className={styles.waveBar}></div>
              <span className={styles.waveText}>Recording audio...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={`${styles.inputCapsule} ${isFocused ? styles.inputCapsuleFocused : ""}`}>
            <textarea
              ref={textareaRef}
              className={styles.inputArea}
              placeholder={threadId ? "Ask SAGE a question or request a database analysis..." : "Initializing workspace session..."}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isStreaming && threadId) {
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isStreaming || !threadId}
            />
            
            {/* Integrated Controls Row */}
            <div className={styles.capsuleActionsRow}>
              <div className={styles.leftActions}>
                <input 
                  type="file" 
                  accept="application/pdf,image/*,video/*,audio/*" 
                  ref={fileInputRef} 
                  style={{ display: "none" }} 
                  onChange={handleFileUpload} 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.capsuleBtn}
                  disabled={isStreaming || !threadId || isUploadingFile}
                  title="Attach filesystem contexts"
                >
                  <Plus size={16} />
                </button>
                <div className={styles.modelSelectWrapper}>
                  <select
                    className={styles.modelSelector}
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isStreaming || !threadId}
                  >
                    {UNIFIED_MODELS.map(m => {
                      const isConfigured = m.provider === "auto" || providerAvailability[m.provider] !== false;
                      const displayName = isConfigured ? m.name : `${m.name} (Key missing)`;
                      return (
                        <option key={m.id} value={m.id} disabled={!isConfigured}>
                          {displayName}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              
              <div className={styles.rightActions}>
                <button
                  type="button"
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`${styles.capsuleBtn} ${isRecording ? styles.micActive : ""}`}
                  disabled={isStreaming || !threadId}
                  title={isRecording ? "Stop and transcribe voice" : "Dictate query"}
                >
                  {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button 
                  type="submit" 
                  className={styles.sendButton} 
                  disabled={!input.trim() || isStreaming || !threadId}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
