"use client";

import { useState } from "react";
import { PersonalizeResponse } from "@/lib/types";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PersonalizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPersonalized, setShowPersonalized] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

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
      setLoading(false);
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
                  <span>Generating Personalization...</span>
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

          {/* Full-width iframe */}
          <div style={{ 
            borderRadius: "0.75rem", 
            overflow: "hidden", 
            border: showPersonalized ? "2px solid var(--primary)" : "2px solid var(--border)",
            transition: "border-color 0.3s"
          }}>
            <iframe 
              srcDoc={showPersonalized ? result.modifiedHtml : result.originalHtml} 
              title={showPersonalized ? "Personalized Page" : "Original Page"}
              sandbox="allow-same-origin"
              style={{
                width: "100%",
                height: "80vh",
                border: "none",
                background: "#fff",
              }}
            />
          </div>

          {/* Changes Summary */}
          <div className="changes-list">
            <h2 style={{ marginBottom: "1.5rem" }}>
              Personalization Strategy 
              <span className="badge" style={{ marginLeft: "0.75rem" }}>
                {result.changes.length} changes
              </span>
            </h2>
            <div className="card">
              <p style={{ marginBottom: "2rem", fontSize: "1.1rem" }}>{result.summary}</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {result.changes.map((change, i) => (
                  <div key={i} className="change-item">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span className="badge">{change.category.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {Math.round(change.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p style={{ fontWeight: "600", fontSize: "0.9rem" }}>{change.croRationale}</p>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                      <span style={{ color: "#ef4444" }}>— {change.originalValue}</span>
                      <br />
                      <span style={{ color: "#22c55e" }}>+ {change.newValue}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
