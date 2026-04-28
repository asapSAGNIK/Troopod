"use client";

import { useState } from "react";
import { PersonalizeResponse } from "@/lib/types";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PersonalizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPersonalized, setShowPersonalized] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    
    const formData = new FormData(e.currentTarget);

    const timer5s = setTimeout(() => {
      setStatusMessage("Takes up to 15 seconds...");
    }, 5000);

    const timer7s = setTimeout(() => {
      setStatusMessage(null);
    }, 7000);

    try {
      const res = await fetch("/api/personalize", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || "Something went wrong");
      }

      const data = await res.json();
      setResult(data);
      setShowPersonalized(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearTimeout(timer5s);
      clearTimeout(timer7s);
      setLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <main className="container">
      <div className="hero">
        <h1>Troopod AI</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "1.25rem" }}>
          Ad-to-Landing-Page Personalization Engine
        </p>
      </div>

      {!result ? (
        <section className="card" style={{ maxWidth: "600px", margin: "0 auto" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="adFile">Ad Creative (Upload Image)</label>
              <input type="file" id="adFile" name="adFile" accept="image/*" required />
            </div>

            <div className="form-group">
              <label htmlFor="landingPageUrl">Target Landing Page URL</label>
              <input 
                type="url" 
                id="landingPageUrl"
                name="landingPageUrl" 
                placeholder="https://example.com" 
                required 
              />
            </div>

            <button type="submit" id="submit-btn" className="btn" disabled={loading} style={{ width: "100%", minHeight: "3.5rem" }}>
              {loading ? (
                <div className="loader-container">
                  <span className="loader"></span>
                  <span>{statusMessage || "Generating Personalization..."}</span>
                </div>
              ) : (
                "Optimize Page"
              )}
            </button>
            
            {error && (
              <p style={{ color: "#ef4444", marginTop: "1rem", fontSize: "0.875rem" }}>
                Error: {error}
              </p>
            )}
          </form>
        </section>
      ) : (
        <div>
          {/* Top controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <button onClick={() => setResult(null)} className="btn" style={{ background: "#27272a" }}>
              ← Start Over
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
              {/* Device Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#27272a", padding: "0.25rem", borderRadius: "0.5rem" }}>
                <button
                  onClick={() => setIsMobileView(false)}
                  style={{
                    background: !isMobileView ? "#3f3f46" : "transparent",
                    border: "none",
                    borderRadius: "0.25rem",
                    padding: "0.4rem",
                    cursor: "pointer",
                    color: !isMobileView ? "#fff" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  title="Desktop View"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </button>
                <button
                  onClick={() => setIsMobileView(true)}
                  style={{
                    background: isMobileView ? "#3f3f46" : "transparent",
                    border: "none",
                    borderRadius: "0.25rem",
                    padding: "0.4rem",
                    cursor: "pointer",
                    color: isMobileView ? "#fff" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  title="Mobile View"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Toggle Switch */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ 
                fontSize: "0.9rem", 
                fontWeight: !showPersonalized ? 700 : 400,
                color: !showPersonalized ? "#fff" : "var(--text-muted)",
                transition: "all 0.3s"
              }}>
                Original
              </span>
              <button
                id="toggle-view"
                onClick={() => setShowPersonalized(!showPersonalized)}
                style={{
                  width: "56px",
                  height: "28px",
                  borderRadius: "9999px",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  background: showPersonalized 
                    ? "linear-gradient(135deg, var(--primary), var(--accent))" 
                    : "#3f3f46",
                  transition: "background 0.3s",
                }}
              >
                <div style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: "3px",
                  left: showPersonalized ? "31px" : "3px",
                  transition: "left 0.3s",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }} />
              </button>
              <span style={{ 
                fontSize: "0.9rem", 
                fontWeight: showPersonalized ? 700 : 400,
                color: showPersonalized ? "var(--primary)" : "var(--text-muted)",
                transition: "all 0.3s"
              }}>
                Personalized
              </span>
            </div>
            </div>

            <span style={{ 
              fontSize: "0.75rem", 
              color: "var(--text-muted)",
              background: "#1e1e20",
              padding: "0.4rem 0.8rem",
              borderRadius: "0.5rem"
            }}>
              {Math.round(result.processingTime.totalMs / 1000)}s total
            </span>
          </div>

          {/* Dual iframes — CSS visibility toggle for instant switching, no reload */}
          <div style={{ 
            borderRadius: "0.75rem", 
            overflow: "hidden", 
            border: showPersonalized ? "2px solid var(--primary)" : "2px solid var(--border)",
            transition: "border-color 0.3s",
            width: isMobileView ? "390px" : "100%",
            margin: "0 auto",
            backgroundColor: "#fff",
            boxShadow: isMobileView ? "0 10px 25px -5px rgba(0, 0, 0, 0.5)" : "none",
            position: "relative",
          }}>
            {/* Original iframe */}
            <iframe
              srcDoc={result.originalHtml}
              title="Original Page"
              sandbox="allow-scripts"
              style={{
                width: "100%",
                height: isMobileView ? "844px" : "calc(100vh - 110px)",
                border: "none",
                background: "#fff",
                display: showPersonalized ? "none" : "block",
              }}
            />
            {/* Personalized iframe */}
            <iframe
              srcDoc={result.modifiedHtml}
              title="Personalized Page"
              sandbox="allow-scripts"
              style={{
                width: "100%",
                height: isMobileView ? "844px" : "calc(100vh - 110px)",
                border: "none",
                background: "#fff",
                display: showPersonalized ? "block" : "none",
              }}
            />
          </div>

        </div>
      )}
    </main>
  );
}
