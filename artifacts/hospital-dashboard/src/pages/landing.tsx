import { useLocation } from "wouter";

const SERIF = "'Playfair Display', Georgia, serif";

const STATS = [
  { value: "5,945", label: "Service listings" },
  { value: "50",    label: "Ontario counties" },
  { value: "140+",  label: "Data fields" },
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

  return (
    <div style={{ minHeight:"100vh", background:"var(--color-bg)", fontFamily:"var(--font-sans)", display:"flex", flexDirection:"column" }}>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <header style={{ borderBottom:"1px solid var(--color-border)", background:"var(--color-surface)", padding:"0 var(--space-8)", height:50, display:"flex", alignItems:"center" }}>
        <div style={{ maxWidth:900, width:"100%", margin:"0 auto", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:24, height:24, borderRadius:3, background:"var(--color-accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="7" width="3" height="8" fill="white" rx="0.5"/>
              <rect x="6" y="4" width="3" height="11" fill="white" rx="0.5"/>
              <rect x="11" y="1" width="3" height="14" fill="white" rx="0.5"/>
            </svg>
          </div>
          <span style={{ fontSize:13, fontWeight:600, fontFamily:SERIF, color:"var(--color-text-primary)" }}>
            Ontario Mental Health Services
          </span>
          <span style={{ color:"var(--color-border)", fontSize:11, marginLeft:2 }}>·</span>
          <span style={{ fontSize:11, color:"var(--color-text-muted)" }}>KHP 2019 MOH Export</span>
        </div>
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

          <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:56 }}>
            <button
              onClick={() => navigate("/dashboard")}
              style={{ padding:"11px 28px", fontSize:14, fontWeight:600, fontFamily:"var(--font-sans)", background:"var(--color-accent)", color:"#fff", border:"none", borderRadius:5, cursor:"pointer", letterSpacing:"0.01em" }}>
              View Dashboard
            </button>
            <span style={{ fontSize:12, color:"var(--color-text-muted)" }}>
              No login required · all data is publicly available
            </span>
          </div>

          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"var(--space-4)", marginBottom:56 }}>
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
          <div style={{ borderTop:"1px solid var(--color-border-subtle)", paddingTop:40, display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"var(--space-5)" }}>
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
      <footer style={{ borderTop:"1px solid var(--color-border-subtle)", padding:"var(--space-5) var(--space-8)", textAlign:"center", fontSize:11, color:"var(--color-text-muted)", fontFamily:"var(--font-sans)" }}>
        Data source: Kids Help Phone · Ontario Ministry of Health Open Data Export, 2019 · For internal analytics use only
      </footer>

    </div>
  );
}
