/**
 * Ontario Mental Health Services: Analytics Dashboard
 *
 * Data flow:
 *   Excel (KHP 2019 MOH) → PostgreSQL → Express API → React Query → UI
 *
 * All chart data comes from real SQL aggregation queries.
 * Filters propagate to every query so all panels stay consistent.
 */

import { useState, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import { useTheme } from "@/lib/useTheme";
import { Mail } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  useGetAnalyticsKpis,
  useGetServicesByCategory,
  useGetServicesByCounty,
  useGetEligibilityByAge,
  useGetEligibilityByGender,
  useGetLanguageDistribution,
  useGetServicesReport,
  useGetFilterCounties,
  useGetFilterTaxonomyTerms,
} from "@workspace/api-client-react";

const CHART_WARM  = ["#78532a","#a0723d","#c4a882","#5c3e1f","#d9c4a8","#8f6335","#e8d9c4","#4a3319","#b89060","#6e4d27","#cfb090","#3d2a12"];
const COUNTY_WARM = ["#78532a","#8f6335","#a0723d","#b08050","#c4906a","#78532a","#8f6335","#a0723d","#b08050","#c4906a","#78532a","#8f6335","#a0723d","#b08050","#c4906a","#78532a","#8f6335","#a0723d","#b08050","#c4906a"];
const PIE_WARM    = ["#78532a","#c4a882","#a0723d","#e8d9c4"];

const SERIF    = "'Playfair Display', Georgia, serif";
const PAGE_SIZE = 100;

interface Filters {
  county?: string;
  taxonomyTerm?: string;
  bilingual?: string;
  lgbtq?: string;
  harmReduction?: string;
  ageGroup?: string;
  gender?: string;
}

const AGE_GROUPS    = ["Children (0–11)","Adolescents (12–17)","Youth & Young Adults (12–25)","Adults (18+)","All Ages"];
const GENDER_GROUPS = ["Female Only","Male Only","All Genders"];

type SortDir = "asc" | "desc";

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="card-kpi" style={{ padding:"var(--space-6)" }}>
      <div className="skeleton" style={{ height:9, width:"55%", marginBottom:14 }} />
      <div className="skeleton" style={{ height:32, width:"40%", marginBottom:10 }} />
      <div className="skeleton" style={{ height:8, width:"65%" }} />
    </div>
  );
}

function KpiCard({ label, value, sub, pct, delay=0 }: { label:string; value?:number; sub?:string; pct?:number; delay?:number }) {
  return (
    <div className="card-kpi animate-in" style={{ padding:"var(--space-6)", animationDelay:`${delay}ms` }}>
      <p style={{ fontSize:"var(--text-xs)", fontWeight:600, letterSpacing:"0.09em", textTransform:"uppercase", color:"var(--color-text-muted)", margin:"0 0 10px", fontFamily:"var(--font-sans)" }}>
        {label}
      </p>
      <p style={{ fontSize:"var(--text-2xl)", fontWeight:700, fontFamily:SERIF, color:"var(--color-text-primary)", lineHeight:1, margin:"0 0 5px" }}>
        {value?.toLocaleString() ?? "—"}
      </p>
      {pct !== undefined && (
        <p style={{ fontSize:"var(--text-xs)", color:"var(--color-accent-mid)", fontWeight:600, margin:"0 0 4px", fontFamily:"var(--font-sans)" }}>
          {pct === 0 ? "<1" : pct}% of services
        </p>
      )}
      {sub && <p style={{ fontSize:"var(--text-xs)", color:"var(--color-text-muted)", margin:0, fontFamily:"var(--font-sans)" }}>{sub}</p>}
    </div>
  );
}

function CategoryTick({ x, y, payload, fill = "#6b6560" }: { x?: number; y?: number; payload?: { value: string }; fill?: string }) {
  const name = payload?.value ?? "";
  let lines: string[];
  if (name.length <= 26) {
    lines = [name];
  } else {
    const mid = Math.ceil(name.length / 2);
    const brk = name.lastIndexOf(" ", mid + 6);
    const at  = brk > 4 ? brk : name.indexOf(" ", mid - 6);
    if (at > 0) {
      const rest = name.slice(at + 1);
      lines = [name.slice(0, at), rest.length > 27 ? rest.slice(0, 25) + "…" : rest];
    } else {
      lines = [name.slice(0, 26), name.slice(26, 50) + (name.length > 50 ? "…" : "")];
    }
  }
  const dy = lines.length === 2 ? -7 : 0;
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={dy + i * 14} textAnchor="end"
          fill={fill} fontSize={10} fontFamily="Inter,sans-serif" dominantBaseline="middle">
          {line}
        </text>
      ))}
    </g>
  );
}

function ChartSkeleton({ height=300 }: { height?:number }) {
  return (
    <div style={{ height, display:"flex", alignItems:"flex-end", gap:8, padding:"0 4px" }}>
      {[65,45,80,35,70,50,85,40,60,55].map((h,i) => (
        <div key={i} className="skeleton" style={{ flex:1, height:`${h}%` }} />
      ))}
    </div>
  );
}

function EmptyChart({ height=280 }: { height?:number }) {
  return (
    <div style={{ height, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="2" y="14" width="6" height="16" rx="1" fill="var(--color-border)" />
        <rect x="13" y="8" width="6" height="22" rx="1" fill="var(--color-border)" />
        <rect x="24" y="18" width="6" height="12" rx="1" fill="var(--color-border)" />
        <line x1="0" y1="30.5" x2="32" y2="30.5" stroke="var(--color-border)" strokeWidth="1"/>
      </svg>
      <p style={{ fontSize:12, color:"var(--color-text-muted)", margin:0, fontFamily:"var(--font-sans)" }}>No data for this selection</p>
    </div>
  );
}

function SectionHeader({ title, note }: { title:string; note?:string }) {
  return (
    <div style={{ marginBottom:"var(--space-4)", paddingBottom:"var(--space-3)", borderBottom:"1px solid var(--color-border-subtle)" }}>
      <p style={{ fontSize:"var(--text-base)", fontWeight:700, fontFamily:SERIF, color:"var(--color-text-primary)", margin:0, lineHeight:1.3 }}>
        {title}
      </p>
      {note && <p style={{ fontSize:"var(--text-xs)", color:"var(--color-text-muted)", margin:"4px 0 0", fontFamily:"var(--font-sans)", letterSpacing:"0.01em" }}>{note}</p>}
    </div>
  );
}

function TTip({ active, payload, label }: { active?:boolean; payload?:Array<{value:number}>; label?:string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--color-surface)", border:"1px solid var(--color-border)", borderRadius:4, padding:"10px 14px", fontSize:12, fontFamily:"var(--font-sans)" }}>
      <p style={{ fontWeight:600, color:"var(--color-text-primary)", margin:"0 0 3px" }}>{label}</p>
      <p style={{ color:"var(--color-accent)", margin:0 }}>{payload[0].value.toLocaleString()} services</p>
    </div>
  );
}

function Toggle({ label, active, onChange }: { label:string; active:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button
      onClick={() => onChange(!active)}
      style={{
        display:"inline-flex", alignItems:"center", gap:6,
        padding:"4px 13px", fontSize:12, fontWeight:500,
        fontFamily:"var(--font-sans)",
        border:`1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
        borderRadius:20,
        background:active ? "var(--color-accent)" : "transparent",
        color:active ? "#fff" : "var(--color-text-secondary)",
        cursor:"pointer", transition:"all var(--duration-fast) var(--ease-out)",
        userSelect:"none", whiteSpace:"nowrap",
      }}>
      {label}
    </button>
  );
}

function Sel({ value, onChange, options, placeholder, width=150 }: {
  value:string; onChange:(v:string)=>void; options:string[]; placeholder:string; width?:number;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding:"5px 8px", fontSize:12, fontFamily:"var(--font-sans)",
        border:`1px solid ${value ? "var(--color-accent)" : "var(--color-border)"}`,
        borderRadius:4,
        background:value ? "var(--color-accent-light)" : "var(--color-surface)",
        color:value ? "var(--color-accent)" : "var(--color-text-secondary)",
        cursor:"pointer", outline:"none",
        width, maxWidth:width, minWidth:width,
        transition:"border-color var(--duration-fast) var(--ease-out)",
      }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function FilterPill({ label, onRemove }: { label:string; onRemove:()=>void }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      padding:"2px 8px 2px 10px", fontSize:11, fontFamily:"var(--font-sans)",
      background:"var(--color-accent-light)", color:"var(--color-accent)",
      border:"1px solid #e0cdb8", borderRadius:20,
    }}>
      {label}
      <button onClick={onRemove} style={{
        background:"none", border:"none", cursor:"pointer", padding:0,
        color:"var(--color-accent)", fontSize:13, lineHeight:1, opacity:0.7,
        display:"flex", alignItems:"center",
      }}>×</button>
    </span>
  );
}

function BoolCell({ value }: { value?:boolean|null }) {
  return (
    <td style={{ padding:"7px 12px", textAlign:"center" }}>
      {value
        ? <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#78532a" }} />
        : <span style={{ color:"var(--color-border)", fontSize:13 }}>·</span>}
    </td>
  );
}

function SortTh({ label, sortK, current, dir, onSort }: {
  label:string; sortK:string; current:string; dir:SortDir; onSort:(k:string)=>void;
}) {
  const active = current === sortK;
  return (
    <th
      onClick={() => onSort(sortK)}
      style={{
        padding:"9px 12px", textAlign:"left", fontWeight:600,
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
        letterSpacing:"0.06em", textTransform:"uppercase", fontSize:10,
        whiteSpace:"nowrap", fontFamily:"var(--font-sans)",
        cursor:"pointer", userSelect:"none",
        borderBottom: active ? `2px solid var(--color-accent)` : "2px solid transparent",
      }}>
      {label}{active ? (dir==="asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildContext(filters: Filters, total?: number): string {
  const subject = filters.taxonomyTerm ?? "All services";
  const loc     = filters.county ? ` in ${filters.county}` : "";
  const flags   = [
    filters.ageGroup,
    filters.gender,
    filters.bilingual === "true"     && "Bilingual",
    filters.lgbtq === "true"         && "LGBTQ+ affirming",
    filters.harmReduction === "true" && "Harm reduction",
  ].filter(Boolean) as string[];
  const flagStr = flags.length ? ` · ${flags.join(", ")}` : "";
  const countStr = total !== undefined ? ` · ${total.toLocaleString()} records` : "";
  return `${subject}${loc}${flagStr}${countStr}`;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { isDark, toggle: toggleTheme } = useTheme();
  const tickColor   = isDark ? "#a09080" : "#9c9590";
  const tickDark    = isDark ? "#c8baa8" : "#6b6560";
  const gridColor   = isDark ? "#3d3429" : "#f0ece6";
  const cursorFill  = isDark ? "#2d261d" : "#faf8f4";
  const pieTTip     = { background:"var(--color-surface)", border:"1px solid var(--color-border)", borderRadius:4, fontSize:12, fontFamily:"var(--font-sans)" };
  const [filters, setFilters]   = useState<Filters>({});
  const [search, setSearch]     = useState("");
  const [tab, setTab]           = useState<"charts"|"report">("charts");
  const [sortKey, setSortKey]   = useState("publicName");
  const [sortDir, setSortDir]   = useState<SortDir>("asc");
  const [page, setPage]         = useState(1);
  const [expandedRow, setExpandedRow] = useState<string|null>(null);

  const set = (k: keyof Filters, v: string|undefined) =>
    setFilters(f => ({ ...f, [k]: v || undefined }));

  const activeCount = Object.values(filters).filter(Boolean).length;
  const clear = () => { setFilters({}); setSearch(""); window.history.replaceState(null,"",window.location.pathname); };

  const { data: counties  = [] } = useGetFilterCounties();
  const { data: taxTerms  = [] } = useGetFilterTaxonomyTerms();
  const { data: kpis,       isLoading: kpiL, isFetching: kpiF } = useGetAnalyticsKpis(filters);
  const { data: byCat = [], isLoading: catL, isFetching: catF } = useGetServicesByCategory(filters);
  const { data: byCty = [], isLoading: ctyL, isFetching: ctyF } = useGetServicesByCounty(filters);
  const { data: byAge = [], isLoading: ageL, isFetching: ageF } = useGetEligibilityByAge(filters);
  const { data: byGen = [], isLoading: genL, isFetching: genF } = useGetEligibilityByGender(filters);
  const { data: byLan = [], isLoading: lanL, isFetching: lanF } = useGetLanguageDistribution(filters);

  const isUpdating = (!kpiL && kpiF) || (!catL && catF) || (!ctyL && ctyF) || (!ageL && ageF) || (!genL && genF) || (!lanL && lanF);
  const { data: rpt   = [], isLoading: rptL } = useGetServicesReport(
    { ...filters, search: search || undefined },
    { query: { enabled: tab === "report" } }
  );

  // Initialize filters from URL on first load
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const init: Filters = {};
    if (p.get("county"))    init.county        = p.get("county")!;
    if (p.get("cat"))       init.taxonomyTerm  = p.get("cat")!;
    if (p.get("age"))       init.ageGroup      = p.get("age")!;
    if (p.get("gender"))    init.gender        = p.get("gender")!;
    if (p.get("bilingual")) init.bilingual     = "true";
    if (p.get("lgbtq"))     init.lgbtq         = "true";
    if (p.get("harm"))      init.harmReduction = "true";
    if (Object.keys(init).length > 0) setFilters(init);
  }, []); // mount only

  // Sync filters → URL so the view is shareable / survives refresh
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.county)                     p.set("county",    filters.county);
    if (filters.taxonomyTerm)               p.set("cat",       filters.taxonomyTerm);
    if (filters.ageGroup)                   p.set("age",       filters.ageGroup);
    if (filters.gender)                     p.set("gender",    filters.gender);
    if (filters.bilingual === "true")       p.set("bilingual", "1");
    if (filters.lgbtq === "true")           p.set("lgbtq",     "1");
    if (filters.harmReduction === "true")   p.set("harm",      "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [filters]);

  useEffect(() => { setPage(1); }, [rpt, sortKey, sortDir]);

  const sorted = [...rpt].sort((a, b) => {
    const va = String((a as Record<string,unknown>)[sortKey] ?? "");
    const vb = String((b as Record<string,unknown>)[sortKey] ?? "");
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  const totalPages  = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pagedRows   = sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const handleSort = (k: string) => {
    if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const exportCsv = () => {
    if (!rpt.length) return;
    const hdrs = ["ID","Public Name","Official Name","Category","City","County","Age Group","Gender","Languages","Bilingual","LGBTQ+","Harm Reduction","Wait Time","Website"];
    const rows = rpt.map(r => [
      r.id,
      `"${(r.publicName??'').replace(/"/g,'""')}"`,
      `"${(r.officialName??'').replace(/"/g,'""')}"`,
      `"${(r.category??'').replace(/"/g,'""')}"`,
      r.physicalCity??'', r.physicalCounty??'',
      r.eligibilityAgeGroup??'', r.eligibilityByGender??'',
      `"${(r.languagesOfferedList??'').replace(/"/g,'""')}"`,
      r.bilingualService?'Yes':'No', r.lgbtqSupport?'Yes':'No', r.harmReduction?'Yes':'No',
      `"${(r.normalWaitTime??'').replace(/"/g,'""')}"`, r.websiteAddress??'',
    ]);
    const csv = [hdrs.join(","), ...rows.map(r => r.join(","))].join("\n");
    const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv"})),download:"ontario_mental_health_services.csv"});
    a.click();
  };


  const genTotal = byGen.reduce((s:number,r:{count:number})=>s+r.count, 0);
  const lanTotal = byLan.reduce((s:number,r:{count:number})=>s+r.count, 0);

  // Active filter pills data
  const pills: { label:string; remove:()=>void }[] = [
    ...(filters.county       ? [{ label:`County: ${filters.county}`,     remove:()=>set("county",undefined)       }] : []),
    ...(filters.taxonomyTerm ? [{ label:`Category: ${filters.taxonomyTerm}`, remove:()=>set("taxonomyTerm",undefined) }] : []),
    ...(filters.ageGroup     ? [{ label:`Age: ${filters.ageGroup}`,      remove:()=>set("ageGroup",undefined)     }] : []),
    ...(filters.gender       ? [{ label:`Gender: ${filters.gender}`,     remove:()=>set("gender",undefined)       }] : []),
    ...(filters.bilingual==="true"     ? [{ label:"Bilingual",     remove:()=>set("bilingual",undefined)     }] : []),
    ...(filters.lgbtq==="true"         ? [{ label:"LGBTQ+",         remove:()=>set("lgbtq",undefined)         }] : []),
    ...(filters.harmReduction==="true" ? [{ label:"Harm Reduction", remove:()=>set("harmReduction",undefined) }] : []),
  ];

  return (
    <div style={{ minHeight:"100vh", background:"var(--color-bg)", fontFamily:"var(--font-sans)" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        background:"var(--color-surface)", borderBottom:"1px solid var(--color-border)",
        padding:"0 var(--space-8)", height:54,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center",
      }}>
        <div style={{ maxWidth:1400, width:"100%", margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <a href={import.meta.env.BASE_URL} style={{ display:"flex", alignItems:"center", gap:12, textDecoration:"none" }}>
            <div style={{ textAlign:"left" }}>
              <h1 style={{ fontSize:15, fontWeight:700, fontFamily:SERIF, color:"var(--color-text-primary)", margin:0, lineHeight:1.2 }}>
                Ontario Mental Health Services
              </h1>
              <p style={{ fontSize:11, color:"var(--color-text-muted)", margin:0, fontFamily:"var(--font-sans)" }}>
                KHP 2019 MOH Export · {kpis?.totalServices?.toLocaleString() ?? "5,945"} records
              </p>
            </div>
          </a>

          <nav style={{ display:"flex", gap:20, alignItems:"center" }}>
            {(["charts","report"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                background:"none", border:"none",
                borderBottom:`2px solid ${tab===t ? "var(--color-accent)" : "transparent"}`,
                padding:"4px 0", fontSize:13, fontWeight:tab===t ? 600 : 400,
                fontFamily:"var(--font-sans)",
                color:tab===t ? "var(--color-accent)" : "var(--color-text-secondary)",
                cursor:"pointer", transition:"all var(--duration-fast) var(--ease-out)",
                letterSpacing:"0.01em",
              }}>
                {t==="charts" ? "Overview" : "Service Report"}
              </button>
            ))}
            <button onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              style={{ position:"relative", width:52, height:28, borderRadius:14, background:isDark?"var(--color-accent)":"var(--color-border)", border:"none", cursor:"pointer", padding:0, flexShrink:0, transition:"background 200ms" }}>
              <span style={{ position:"absolute", top:3, left:isDark?27:3, width:22, height:22, borderRadius:"50%", background:"var(--color-surface)", transition:"left 200ms", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, lineHeight:1, pointerEvents:"none" }}>
                {isDark ? "☀" : "☾"}
              </span>
            </button>
          </nav>
        </div>
      </header>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div style={{ background:"var(--color-surface)", borderBottom:"1px solid var(--color-border-subtle)" }}>
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"9px var(--space-8)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <Sel value={filters.county??""} onChange={v=>set("county",v)}
            options={counties as string[]} placeholder="All Counties" width={148} />
          <Sel value={filters.taxonomyTerm??""} onChange={v=>set("taxonomyTerm",v)}
            options={taxTerms as string[]} placeholder="All Categories" width={220} />
          <Sel value={filters.ageGroup??""} onChange={v=>set("ageGroup",v)}
            options={AGE_GROUPS} placeholder="Any Age Group" width={168} />
          <Sel value={filters.gender??""} onChange={v=>set("gender",v)}
            options={GENDER_GROUPS} placeholder="Any Gender" width={128} />

          <div style={{ width:1, height:18, background:"var(--color-border)", margin:"0 4px", flexShrink:0 }} />

          <Toggle label="Bilingual"      active={filters.bilingual==="true"}     onChange={v=>set("bilingual",v?"true":undefined)} />
          <Toggle label="LGBTQ+"         active={filters.lgbtq==="true"}         onChange={v=>set("lgbtq",v?"true":undefined)} />
          <Toggle label="Harm Reduction" active={filters.harmReduction==="true"} onChange={v=>set("harmReduction",v?"true":undefined)} />

          {activeCount > 0 && (
            <button onClick={clear} style={{ fontSize:11, color:"var(--color-text-muted)", fontFamily:"var(--font-sans)", background:"none", border:"none", cursor:"pointer", textDecoration:"underline", padding:"0 4px", marginLeft:2 }}>
              Clear all
            </button>
          )}
          {isUpdating && (
            <span style={{ marginLeft:"auto", fontSize:11, color:"var(--color-text-muted)", fontFamily:"var(--font-sans)", display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"var(--color-accent-mid)", animation:"skeleton-pulse 1.2s ease-in-out infinite" }} />
              Updating…
            </span>
          )}
        </div>

        {/* Active filter pills */}
        {pills.length > 0 && (
          <div style={{ maxWidth:1400, margin:"0 auto", padding:"0 var(--space-8) 8px", display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:10, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--color-text-muted)", fontFamily:"var(--font-sans)", marginRight:2 }}>
              Filters:
            </span>
            {pills.map(p => <FilterPill key={p.label} label={p.label} onRemove={p.remove} />)}
          </div>
        )}
      </div>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth:1400, margin:"0 auto", padding:"var(--space-6) var(--space-8) var(--space-10)" }}>

        {/* KPIs */}
        <section style={{ marginBottom:"var(--space-6)" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px,1fr))", gap:"var(--space-4)" }}>
            {kpiL ? (
              [0,1,2,3,4].map(i => <KpiSkeleton key={i} />)
            ) : (
              <>
                <KpiCard label="Total Services"   value={kpis?.totalServices}         sub="Matching current filters"    delay={0}   />
                <KpiCard label="Counties"         value={kpis?.totalCounties}         sub="Geographic regions covered"  delay={50}  />
                <KpiCard label="Bilingual"        value={kpis?.bilingualServices}     pct={kpis?.totalServices ? Math.round((kpis.bilingualServices??0)/kpis.totalServices*100) : undefined} sub="EN/FR service delivery"      delay={100} />
                <KpiCard label="LGBTQ+ Affirming" value={kpis?.lgbtqServices}         pct={kpis?.totalServices ? Math.round((kpis.lgbtqServices??0)/kpis.totalServices*100) : undefined}     sub="Inclusive support services"  delay={150} />
                <KpiCard label="Harm Reduction"   value={kpis?.harmReductionServices} pct={kpis?.totalServices ? Math.round((kpis.harmReductionServices??0)/kpis.totalServices*100) : undefined} sub="Explicitly flagged in dataset" delay={200} />
              </>
            )}
          </div>
        </section>

        {/* ── Context sentence ────────────────────────────────────────── */}
        {activeCount > 0 && (
          <div style={{ margin:"-8px 0 4px", padding:"10px 20px", background:"var(--color-accent-light)", borderRadius:6, fontSize:13, color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)", borderLeft:"3px solid var(--color-accent)" }}>
            <span style={{ color:"var(--color-text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", fontSize:11, fontWeight:600, marginRight:8 }}>Viewing</span>
            {buildContext(filters, kpis?.totalServices)}
          </div>
        )}

        {/* ── Overview tab ─────────────────────────────────────────────── */}
        {tab === "charts" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"var(--space-5)" }}>

            {/* Row 1: Category + County */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--space-5)" }}>

              <div className="card animate-in" style={{ animationDelay:"150ms", opacity: catF && !catL ? 0.65 : 1, transition:"opacity 200ms" }}>
                <SectionHeader title="Services by Category" note="Top 12 service types · click a bar to filter by category" />
                {catL ? <ChartSkeleton height={460} /> : byCat.length === 0 ? <EmptyChart height={460} /> : (
                  <ResponsiveContainer width="100%" height={460}>
                    <BarChart data={byCat} layout="vertical" margin={{ left:4, right:52, top:4, bottom:2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:11, fill:tickColor, fontFamily:"var(--font-sans)" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="category" width={230}
                        tick={<CategoryTick fill={tickDark} />} axisLine={false} tickLine={false} interval={0} />
                      <Tooltip content={<TTip />} cursor={{ fill:cursorFill }} />
                      <Bar dataKey="count" radius={[0,3,3,0]} maxBarSize={20} minPointSize={3} style={{ cursor:"pointer" }}
                        isAnimationActive={false}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={(p: any) => p.value == null ? null : (
                          <text key={p.index} x={p.x+p.width+5} y={p.y+(p.height??18)/2} fill={tickDark}
                            fontSize={10} dominantBaseline="middle" fontFamily="Inter,sans-serif">
                            {Number(p.value).toLocaleString()}
                          </text>
                        )}
                        onClick={(data: {category:string}) => set("taxonomyTerm", filters.taxonomyTerm===data.category ? undefined : data.category)}>
                        {byCat.map((entry:{category:string},i:number) => (
                          <Cell key={i} fill={CHART_WARM[i%CHART_WARM.length]}
                            opacity={filters.taxonomyTerm && filters.taxonomyTerm!==entry.category ? 0.35 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card animate-in" style={{ animationDelay:"200ms", opacity: ctyF && !ctyL ? 0.65 : 1, transition:"opacity 200ms" }}>
                <SectionHeader title="Services by County" note="Top 20 Ontario counties · click a bar to filter by county" />
                {ctyL ? <ChartSkeleton height={460} /> : byCty.length === 0 ? <EmptyChart height={460} /> : (
                  <ResponsiveContainer width="100%" height={460}>
                    <BarChart data={byCty} layout="vertical" margin={{ left:4, right:52, top:6, bottom:2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:11, fill:tickColor, fontFamily:"var(--font-sans)" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="county" width={136} interval={0}
                        tick={{ fontSize:10, fill:tickDark, fontFamily:"var(--font-sans)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<TTip />} cursor={{ fill:cursorFill }} />
                      <Bar dataKey="count" radius={[0,3,3,0]} maxBarSize={14} style={{ cursor:"pointer" }}
                        isAnimationActive={false}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={(p: any) => p.value == null ? null : (
                          <text key={p.index} x={p.x+p.width+5} y={p.y+(p.height??14)/2} fill={tickDark}
                            fontSize={10} dominantBaseline="middle" fontFamily="Inter,sans-serif">
                            {Number(p.value).toLocaleString()}
                          </text>
                        )}
                        onClick={(data: {county:string}) => set("county", filters.county===data.county ? undefined : data.county)}>
                        {byCty.map((entry:{county:string},i:number) => (
                          <Cell key={i} fill={COUNTY_WARM[i%COUNTY_WARM.length]}
                            opacity={filters.county && filters.county!==entry.county ? 0.35 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Row 2: Age + Gender + Language */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"var(--space-5)" }}>

              <div className="card animate-in" style={{ animationDelay:"250ms" }}>
                <SectionHeader title="Age Eligibility" note="Services by declared age group" />
                {ageL ? <ChartSkeleton height={260} /> : byAge.length === 0 ? <EmptyChart height={260} /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={byAge} margin={{ left:24, right:12, top:4, bottom:72 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="ageGroup" tick={{ fontSize:10, fill:tickDark, fontFamily:"var(--font-sans)" }} axisLine={false} tickLine={false} angle={-28} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize:11, fill:tickColor, fontFamily:"var(--font-sans)" }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<TTip />} cursor={{ fill:cursorFill }} />
                      <Bar dataKey="count" radius={[3,3,0,0]} fill="#78532a" maxBarSize={40}
                        isAnimationActive={false}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={(p: any) => p.value == null ? null : (
                          <text key={p.index} x={p.x+(p.width??0)/2} y={p.y-5} fill={tickDark}
                            fontSize={10} textAnchor="middle" fontFamily="Inter,sans-serif">
                            {Number(p.value).toLocaleString()}
                          </text>
                        )} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card animate-in" style={{ animationDelay:"300ms" }}>
                <SectionHeader title="Gender Eligibility" note="Services by declared gender eligibility" />
                {genL ? (
                  <div style={{ height:260, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div className="skeleton" style={{ width:140, height:140, borderRadius:"50%" }} />
                  </div>
                ) : byGen.length === 0 ? <EmptyChart height={260} /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={byGen} dataKey="count" nameKey="gender"
                        cx="50%" cy="45%" outerRadius={84} innerRadius={44} paddingAngle={3}
                        isAnimationActive={false}>
                        {byGen.map((_:unknown,i:number) => <Cell key={i} fill={PIE_WARM[i%PIE_WARM.length]} />)}
                      </Pie>
                      <Legend formatter={(v:string) => <span style={{ fontSize:11, color:tickDark, fontFamily:"var(--font-sans)" }}>{v}</span>} iconSize={7} />
                      <Tooltip
                        formatter={(v:number) => [`${v.toLocaleString()} (${genTotal>0?Math.round(v/genTotal*100):0}%)`, "Services"]}
                        contentStyle={pieTTip} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card animate-in" style={{ animationDelay:"350ms" }}>
                <SectionHeader title="Language Availability" note="Bilingual (EN/FR) vs. single-language delivery" />
                {lanL ? (
                  <div style={{ height:260, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div className="skeleton" style={{ width:140, height:140, borderRadius:"50%" }} />
                  </div>
                ) : byLan.length === 0 ? <EmptyChart height={260} /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={byLan} dataKey="count" nameKey="language"
                        cx="50%" cy="45%" outerRadius={84} innerRadius={44} paddingAngle={3}
                        isAnimationActive={false}>
                        {byLan.map((_:unknown,i:number) => <Cell key={i} fill={PIE_WARM[i%PIE_WARM.length]} />)}
                      </Pie>
                      <Legend formatter={(v:string) => <span style={{ fontSize:11, color:tickDark, fontFamily:"var(--font-sans)" }}>{v}</span>} iconSize={7} />
                      <Tooltip
                        formatter={(v:number) => [`${v.toLocaleString()} (${lanTotal>0?Math.round(v/lanTotal*100):0}%)`, "Services"]}
                        contentStyle={pieTTip} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Service Report tab ───────────────────────────────────────── */}
        {tab === "report" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"var(--space-4)", gap:12, flexWrap:"wrap" }}>
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, fontFamily:SERIF, margin:0, color:"var(--color-text-primary)" }}>
                  Service Records
                </h2>
                <p style={{ fontSize:11, color:"var(--color-text-muted)", margin:"3px 0 0", fontFamily:"var(--font-sans)" }}>
                  {rptL ? "Loading…" : sorted.length === 0 ? "No records match the current filters" : `Showing ${((page-1)*PAGE_SIZE)+1}–${Math.min(page*PAGE_SIZE,sorted.length)} of ${sorted.length.toLocaleString()} records`}
                </p>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
                  <input
                    type="text" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search service name…"
                    style={{ padding:"6px 28px 6px 10px", fontSize:12, fontFamily:"var(--font-sans)", border:"1px solid var(--color-border)", borderRadius:4, outline:"none", width:220, background:"var(--color-surface)", color:"var(--color-text-primary)" }} />
                  {search && (
                    <button onClick={() => setSearch("")}
                      style={{ position:"absolute", right:7, background:"none", border:"none", cursor:"pointer", padding:0, color:"var(--color-text-muted)", fontSize:15, lineHeight:1, display:"flex", alignItems:"center" }}>
                      ×
                    </button>
                  )}
                </div>
                <button
                  onClick={exportCsv} disabled={!rpt.length}
                  style={{ padding:"6px 18px", fontSize:12, fontWeight:500, fontFamily:"var(--font-sans)", border:"none", borderRadius:4, background:"var(--color-accent)", color:"#fff", cursor:rpt.length?"pointer":"not-allowed", opacity:rpt.length?1:0.5 }}>
                  Export CSV
                </button>
              </div>
            </div>

            <div className="card" style={{ overflow:"hidden", padding:0 }}>
              {rptL ? (
                <div style={{ padding:"var(--space-8)", display:"flex", flexDirection:"column", gap:14 }}>
                  {[0,1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="skeleton" style={{ height:14, width:i%3===0?"40%":"70%" }} />
                  ))}
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"var(--font-sans)" }}>
                    <thead>
                      <tr style={{ background:"var(--color-bg)", borderBottom:"2px solid var(--color-border)" }}>
                        <SortTh label="Service Name" sortK="publicName"          current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortTh label="Category"     sortK="category"            current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortTh label="City"         sortK="physicalCity"        current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortTh label="County"       sortK="physicalCounty"      current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortTh label="Age Group"    sortK="eligibilityAgeGroup" current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortTh label="Gender"       sortK="eligibilityByGender" current={sortKey} dir={sortDir} onSort={handleSort} />
                        <th style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, color:"var(--color-text-muted)", letterSpacing:"0.06em", textTransform:"uppercase", fontSize:10, whiteSpace:"nowrap" }}>Languages</th>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, color:"var(--color-text-muted)", letterSpacing:"0.06em", textTransform:"uppercase", fontSize:10, whiteSpace:"nowrap" }}>Bilingual</th>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, color:"var(--color-text-muted)", letterSpacing:"0.06em", textTransform:"uppercase", fontSize:10, whiteSpace:"nowrap" }}>LGBTQ+</th>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, color:"var(--color-text-muted)", letterSpacing:"0.06em", textTransform:"uppercase", fontSize:10, whiteSpace:"nowrap" }}>Harm Red.</th>
                        <SortTh label="Wait Time" sortK="normalWaitTime" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.length === 0 ? (
                        <tr><td colSpan={11} style={{ padding:"var(--space-8)", textAlign:"center", color:"var(--color-text-muted)", fontSize:13 }}>No records match the current filters.</td></tr>
                      ) : pagedRows.map((row, i) => {
                        const isExp = expandedRow === String(row.id);
                        const rowBg = isExp ? "var(--color-accent-light)" : i%2===0 ? "var(--color-surface)" : "var(--color-bg)";
                        return (
                          <Fragment key={row.id}>
                            <tr
                              style={{ borderBottom: isExp ? "none" : `1px solid var(--color-border-subtle)`, background:rowBg, transition:`background var(--duration-fast)`, cursor:"pointer" }}
                              onMouseEnter={e => { if (!isExp) e.currentTarget.style.background="var(--color-accent-light)"; }}
                              onMouseLeave={e => { if (!isExp) e.currentTarget.style.background=rowBg; }}
                              onClick={() => setExpandedRow(e => e===String(row.id) ? null : String(row.id))}>
                              <td style={{ padding:"8px 12px", maxWidth:220 }}>
                                <div style={{ fontWeight:500, color:"var(--color-text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                  {row.publicName || row.officialName || "—"}
                                </div>
                              </td>
                              <td style={{ padding:"8px 12px", maxWidth:180 }}>
                                <span style={{ color:"var(--color-text-secondary)", overflow:"hidden", textOverflow:"ellipsis", display:"block", whiteSpace:"nowrap" }}>{row.category||"—"}</span>
                              </td>
                              <td style={{ padding:"8px 12px", whiteSpace:"nowrap", color:"var(--color-text-secondary)" }}>{row.physicalCity||"—"}</td>
                              <td style={{ padding:"8px 12px", whiteSpace:"nowrap", color:"var(--color-text-secondary)" }}>{row.physicalCounty||"—"}</td>
                              <td style={{ padding:"8px 12px", whiteSpace:"nowrap", color:"var(--color-text-secondary)" }}>{row.eligibilityAgeGroup||"—"}</td>
                              <td style={{ padding:"8px 12px", whiteSpace:"nowrap", color:"var(--color-text-secondary)" }}>{row.eligibilityByGender||"—"}</td>
                              <td style={{ padding:"8px 12px", maxWidth:160 }}>
                                <span style={{ color:"var(--color-text-secondary)", overflow:"hidden", textOverflow:"ellipsis", display:"block", whiteSpace:"nowrap" }}>{row.languagesOfferedList||"—"}</span>
                              </td>
                              <BoolCell value={row.bilingualService} />
                              <BoolCell value={row.lgbtqSupport} />
                              <BoolCell value={row.harmReduction} />
                              <td style={{ padding:"8px 12px", maxWidth:160, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                                <span style={{ color:"var(--color-text-secondary)", overflow:"hidden", textOverflow:"ellipsis", display:"block", whiteSpace:"nowrap" }}>{row.normalWaitTime||"—"}</span>
                                <span style={{ fontSize:10, color:"var(--color-text-muted)", marginLeft:6, flexShrink:0 }}>{isExp ? "▲" : "▼"}</span>
                              </td>
                            </tr>
                            {isExp && (
                              <tr style={{ borderBottom:`1px solid var(--color-border-subtle)` }}>
                                <td colSpan={11} style={{ padding:"0 12px 14px", background:"var(--color-accent-light)" }}>
                                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"10px 24px", padding:"12px 12px 10px", background:"var(--color-surface)", borderRadius:6, border:"1px solid var(--color-border)" }}>
                                    {[
                                      { label:"Official Name",    value: row.officialName },
                                      { label:"Full Category",    value: row.category },
                                      { label:"City",             value: row.physicalCity },
                                      { label:"County",           value: row.physicalCounty },
                                      { label:"Age Group",        value: row.eligibilityAgeGroup },
                                      { label:"Gender",           value: row.eligibilityByGender },
                                      { label:"Languages",        value: row.languagesOfferedList },
                                      { label:"Wait Time",        value: row.normalWaitTime },
                                      { label:"Bilingual",        value: row.bilingualService ? "Yes" : "No" },
                                      { label:"LGBTQ+ Affirming", value: row.lgbtqSupport ? "Yes" : "No" },
                                      { label:"Harm Reduction",   value: row.harmReduction ? "Yes" : "No" },
                                    ].map(({label,value}) => (
                                      <div key={label}>
                                        <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:700, color:"var(--color-text-muted)", fontFamily:"var(--font-sans)", marginBottom:2 }}>{label}</div>
                                        <div style={{ fontSize:12, color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", wordBreak:"break-word" }}>{value || "—"}</div>
                                      </div>
                                    ))}
                                    {row.websiteAddress && (
                                      <div>
                                        <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:700, color:"var(--color-text-muted)", fontFamily:"var(--font-sans)", marginBottom:2 }}>Website</div>
                                        <a href={row.websiteAddress} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                          style={{ fontSize:12, color:"var(--color-accent)", textDecoration:"none", fontFamily:"var(--font-sans)", wordBreak:"break-all" }}>
                                          {row.websiteAddress} ↗
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderTop:"1px solid var(--color-border-subtle)", background:"var(--color-bg)" }}>
                      <span style={{ fontSize:11, color:"var(--color-text-muted)", fontFamily:"var(--font-sans)" }}>
                        Page {page} of {totalPages}
                      </span>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}
                          style={{ padding:"4px 12px", fontSize:11, fontFamily:"var(--font-sans)", border:"1px solid var(--color-border)", borderRadius:4, background:"var(--color-surface)", color:"var(--color-text-secondary)", cursor:page===1?"not-allowed":"pointer", opacity:page===1?0.4:1 }}>
                          ← Prev
                        </button>
                        <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                          style={{ padding:"4px 12px", fontSize:11, fontFamily:"var(--font-sans)", border:"1px solid var(--color-border)", borderRadius:4, background:"var(--color-surface)", color:"var(--color-text-secondary)", cursor:page===totalPages?"not-allowed":"pointer", opacity:page===totalPages?0.4:1 }}>
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

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
