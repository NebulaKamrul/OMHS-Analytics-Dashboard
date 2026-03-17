import { useLocation } from "wouter";
import { useTheme } from "@/lib/useTheme";
import { Mail } from "lucide-react";

const SERIF = "'Playfair Display', Georgia, serif";

const STATS = [
  { value: "5,945", label: "Service listings" },
  { value: "50",    label: "Ontario counties" },
  { value: "149",    label: "Data fields" },
  { value: "2019",  label: "MOH export year" },
];

const FEATURES = [
  {
    title: "Geographic coverage",
    body:  "Explore the concentration and gaps of mental health services across every county in Ontario, from Toronto to Thunder Bay.",
  },
  {
    title: "Demographic eligibility",
    body:  "Filter by age group, gender, bilingual availability, LGBTQ+ affirming services, and harm reduction approaches.",
  },
  {
    title: "Live record search",
    body:  "Browse and export the full service registry with search, category, and county filters applied in real time.",
  },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const { isDark, toggle: toggleTheme } = useTheme();

  return (
    <div style={{ minHeight:"100vh", background:"var(--color-bg)", fontFamily:"var(--font-sans)", display:"flex", flexDirection:"column" }}>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <header style={{ height:50, borderBottom:"1px solid var(--color-border-subtle)", padding:"0 var(--space-8)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--color-surface)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:13, fontWeight:600, fontFamily:SERIF, color:"var(--color-accent)" }}>
            Ontario Mental Health Services
          </span>
        </div>
        <button onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{ position:"relative", width:52, height:28, borderRadius:14, background:isDark?"var(--color-accent)":"var(--color-border)", border:"none", cursor:"pointer", padding:0, flexShrink:0, transition:"background 200ms" }}>
          <span style={{ position:"absolute", top:3, left:isDark?27:3, width:22, height:22, borderRadius:"50%", background:"var(--color-surface)", transition:"left 200ms", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, lineHeight:1, pointerEvents:"none" }}>
            {isDark ? "☀" : "☾"}
          </span>
        </button>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <main style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"var(--space-8)" }}>
        <div style={{ maxWidth:720, width:"100%", paddingTop:"clamp(40px, 8vw, 96px)", paddingBottom:64 }}>

          <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--color-accent)", margin:"0 0 20px", fontFamily:"var(--font-sans)" }}>
            Data Explorer · Ontario, Canada
          </p>

          <h1 style={{ fontSize:"clamp(32px, 5vw, 52px)", fontWeight:700, fontFamily:SERIF, color:"var(--color-text-primary)", lineHeight:1.15, margin:"0 0 22px" }}>
            Ontario Mental Health<br />
            <span style={{ color:"var(--color-accent)" }}>Services Dashboard</span>
          </h1>

          <p style={{ fontSize:16, lineHeight:1.75, color:"var(--color-text-secondary)", margin:"0 0 36px", maxWidth:580, fontFamily:"var(--font-sans)" }}>
            An interactive analysis of 5,945 publicly funded mental health and addiction services across Ontario, drawn from the 2019 Ministry of Health open data export. Explore geographic distribution, demographic eligibility, language access, and service specializations.
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:56 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <button
                onClick={() => navigate("/dashboard")}
                style={{ padding:"11px 28px", fontSize:14, fontWeight:600, fontFamily:"var(--font-sans)", background:"var(--color-accent)", color:"#fff", border:"none", borderRadius:5, cursor:"pointer", letterSpacing:"0.01em" }}>
                View Dashboard
              </button>
              <span style={{ fontSize:12, color:"var(--color-text-muted)" }}>
                No login required · all data is publicly available
              </span>
            </div>
            <span style={{ fontSize:11, color:"var(--color-text-muted)", fontFamily:"var(--font-sans)", display:"flex", alignItems:"center", gap:5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              Best viewed on a desktop
            </span>
          </div>

          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px,1fr))", gap:"var(--space-4)", marginBottom:56 }}>
            {STATS.map(({ value, label }) => (
              <div key={label} style={{ padding:"var(--space-5)", background:"var(--color-surface)", border:"1px solid var(--color-border)", borderRadius:6 }}>
                <p style={{ fontSize:24, fontWeight:700, fontFamily:SERIF, color:"var(--color-text-primary)", margin:"0 0 4px", lineHeight:1 }}>
                  {value}
                </p>
                <p style={{ fontSize:11, color:"var(--color-text-muted)", margin:0, fontFamily:"var(--font-sans)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Features */}
          <div style={{ borderTop:"1px solid var(--color-border-subtle)", paddingTop:40, display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))", gap:"var(--space-5)" }}>
            {FEATURES.map(({ title, body }) => (
              <div key={title}>
                <p style={{ fontSize:13, fontWeight:700, fontFamily:SERIF, color:"var(--color-text-primary)", margin:"0 0 8px" }}>
                  {title}
                </p>
                <p style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.7, margin:0, fontFamily:"var(--font-sans)" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:"1px solid var(--color-border-subtle)", padding:"18px var(--space-8)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ display:"flex", gap:14, alignItems:"center" }}>
          <a href="https://linkedin.com/in/nebulakamrul" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" style={{ color:"var(--color-text-muted)", display:"flex", alignItems:"center", transition:"color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
          </a>
          <a href="mailto:nebulakamrul@gmail.com" aria-label="Email" style={{ color:"var(--color-text-muted)", display:"flex", alignItems:"center", transition:"color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}>
            <Mail size={15} strokeWidth={1.5} />
          </a>
        </span>
        <span style={{ fontSize:11, color:"var(--color-text-muted)", fontFamily:"var(--font-sans)", letterSpacing:"0.02em" }}>
          built by nebula kamrul
        </span>
      </footer>

    </div>
  );
}
