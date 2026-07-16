"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() })
      });
      
      if (res.ok) {
        const data = await res.json();
        // Save to localStorage
        localStorage.setItem("activeUserId", data.id);
        localStorage.setItem("activeUsername", data.username);
        localStorage.setItem("role", data.role || "user");
        
        router.push("/");
      } else {
        setError("User not found. Try signing up instead.");
      }
    } catch (err) {
      setError("Failed to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() })
      });
      
      if (res.ok) {
        const data = await res.json();
        // Save to localStorage
        localStorage.setItem("activeUserId", data.id);
        localStorage.setItem("activeUsername", data.username);
        localStorage.setItem("role", data.role || "user");
        
        router.push("/");
      } else {
        const errData = await res.json();
        setError(errData.detail || "Username already exists or failed to create.");
      }
    } catch (err) {
      setError("Failed to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <BrainCircuit size={48} style={{ color: "var(--accent-primary)" }} />
        </div>
        <h1 className={styles.title}>SAGE</h1>
        <p className={styles.subtitle}>Smart Analytics & Generative Engine</p>
        
        <form onSubmit={handleLogin}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Username</label>
            <input 
              type="text" 
              className={styles.input} 
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.buttonGroup}>
            <button 
              type="button" 
              className={styles.signupButton} 
              onClick={handleSignup}
              disabled={isLoading || !username.trim()}
            >
              Sign Up
            </button>
            <button 
              type="submit" 
              className={styles.loginButton} 
              disabled={isLoading || !username.trim()}
            >
              {isLoading ? "Please wait..." : "Log In"}
            </button>
          </div>
          
          {error && <p className={styles.errorText}>{error}</p>}
        </form>
      </div>
    </div>
  );
}
