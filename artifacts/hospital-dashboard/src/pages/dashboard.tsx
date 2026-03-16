/**
 * Ontario Mental Health Services: Analytics Dashboard
 *
 * Data flow:
 *   Excel (KHP 2019 MOH) → PostgreSQL → Express API → React Query → UI
 *
 * All chart data comes from real SQL aggregation queries.
 * Filters propagate to every query so all panels stay consistent.
 */

import { useState } from "react";
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

const CHART_BLUE  = ["#1e40af","#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#dbeafe","#eff6ff","#1e3a8a","#1e40af","#2563eb"];
const PIE_COLORS  = ["#1d4ed8","#3b82f6","#93c5fd","#bfdbfe"];

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

function KpiSkeleton() {
  return (
    <div className="card-kpi" style={{ padding:"var(--space-6)" }}>
      <div className="skeleton" style={{ height:10, width:"60%", borderRadius:"var(--radius-sm)", marginBottom:12 }} />
      <div className="skeleton" style={{ height:28, width:"40%", borderRadius:"var(--radius-sm)", marginBottom:8 }} />
      <div className="skeleton" style={{ height:8, width:"70%", borderRadius:"var(--radius-sm)" }} />
    </div>
  );
}

function KpiCard({ label, value, sub, delay=0 }: { label:string; value?:number; sub?:string; delay?:number }) {
  return (
    <div className="card-kpi animate-in" style={{ padding:"var(--space-6)", animationDelay:`${delay}ms` }}>
      <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--color-text-muted)", margin:"0 0 10px" }}>{label}</p>
      <p style={{ fontSize:"var(--text-2xl)", fontWeight:700, color:"var(--color-text-primary)", lineHeight:1, margin:"0 0 6px" }}>
        {value?.toLocaleString() ?? "—"}
      </p>
      {sub && <p style={{ fontSize:11, color:"var(--color-text-muted)", margin:0 }}>{sub}</p>}
    </div>
  );
}

function ChartSkeleton({ height=300 }: { height?:number }) {
  return (
    <div style={{ height, display:"flex", alignItems:"flex-end", gap:8, padding:"0 4px" }}>
      {[65,45,80,35,70,50,85,40,60,55].map((h,i) => (
        <div key={i} className="skeleton" style={{ flex:1, height:`${h}%`, borderRadius:"var(--radius-sm)" }} />
      ))}
    </div>
  );
}

function SectionHeader({ title, note }: { title:string; note?:string }) {
  return (
    <div style={{ marginBottom:"var(--space-4)", paddingBottom:"var(--space-3)", borderBottom:"1px solid var(--color-border-subtle)" }}>
      <p style={{ fontSize:"var(--text-sm)", fontWeight:600, color:"var(--color-text-primary)", margin:0 }}>{title}</p>
      {note && <p style={{ fontSize:11, color:"var(--color-text-muted)", margin:"3px 0 0" }}>{note}</p>}
    </div>
  );
}

function TTip({ active, payload, label }: { active?:boolean; payload?:Array<{value:number}>; label?:string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--color-surface)", border:"1px solid var(--color-border)", borderRadius:"var(--radius-md)", padding:"10px 14px", fontSize:12, boxShadow:"var(--shadow-card)" }}>
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
        padding:"5px 12px", fontSize:12, fontWeight:500,
        border:`1px solid ${active?"var(--color-accent)":"var(--color-border)"}`,
        borderRadius:20,
        background:active?"var(--color-accent)":"var(--color-surface)",
        color:active?"#fff":"var(--color-text-secondary)",
        cursor:"pointer", transition:"all var(--duration-fast) var(--ease-out)",
        userSelect:"none", whiteSpace:"nowrap",
      }}>
      {label}
    </button>
  );
}

function Sel({
  value, onChange, options, placeholder, width=150,
}: {
  value:string; onChange:(v:string)=>void; options:string[];
  placeholder:string; width?:number;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding:"5px 8px", fontSize:12,
        border:`1px solid ${value?"var(--color-accent)":"var(--color-border)"}`,
        borderRadius:"var(--radius-sm)",
        background:value?"var(--color-accent-light)":"var(--color-surface)",
        color:value?"var(--color-accent)":"var(--color-text-secondary)",
        cursor:"pointer", outline:"none",
        width, maxWidth:width, minWidth:width,
        overflow:"hidden", textOverflow:"ellipsis",
        transition:"border-color var(--duration-fast) var(--ease-out)",
      }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function BoolCell({ value }: { value?:boolean|null }) {
  return (
    <td style={{ padding:"7px 12px", textAlign:"center" }}>
      {value
        ? <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#16a34a" }} />
        : <span style={{ color:"var(--color-border)", fontSize:11 }}>·</span>}
    </td>
  );
}

export default function Dashboard() {
  const [filters, setFilters] = useState<Filters>({});
  const [search, setSearch]   = useState("");
  const [tab, setTab]         = useState<"charts"|"report">("charts");

  const set = (k: keyof Filters, v: string|undefined) =>
    setFilters(f => ({ ...f, [k]: v || undefined }));

  const activeCount = Object.values(filters).filter(Boolean).length;
  const clear = () => { setFilters({}); setSearch(""); };

  const { data: counties  = [] } = useGetFilterCounties();
  const { data: taxTerms  = [] } = useGetFilterTaxonomyTerms();
  const { data: kpis,       isLoading: kpiL } = useGetAnalyticsKpis(filters);
  const { data: byCat = [], isLoading: catL } = useGetServicesByCategory(filters);
  const { data: byCty = [], isLoading: ctyL } = useGetServicesByCounty(filters);
  const { data: byAge = [], isLoading: ageL } = useGetEligibilityByAge(filters);
  const { data: byGen = [], isLoading: genL } = useGetEligibilityByGender(filters);
  const { data: byLan = [], isLoading: lanL } = useGetLanguageDistribution(filters);
  const { data: rpt   = [], isLoading: rptL } = useGetServicesReport(
    { ...filters, search: search || undefined },
    { query: { enabled: tab === "report" } }
  );

  const exportCsv = () => {
    if (!rpt.length) return;
    const hdrs = ["ID","Public Name","Official Name","Category","City","County","Age Group","Gender","Languages","Bilingual","LGBTQ+","Harm Reduction","Wait Time","Website"];
    const rows = rpt.map(r => [
      r.id,
      `"${(r.publicName??'').replace(/"/g,'""')}"`,
      `"${(r.officialName??'').replace(/"/g,'""')}"`,
      `"${(r.category??'').replace(/"/g,'""')}"`,
      r.physicalCity??'',
      r.physicalCounty??'',
      r.eligibilityAgeGroup??'',
      r.eligibilityByGender??'',
      `"${(r.languagesOfferedList??'').replace(/"/g,'""')}"`,
      r.bilingualService?'Yes':'No',
      r.lgbtqSupport?'Yes':'No',
      r.harmReduction?'Yes':'No',
      `"${(r.normalWaitTime??'').replace(/"/g,'""')}"`,
      r.websiteAddress??'',
    ]);
    const csv = [hdrs.join(","), ...rows.map(r => r.join(","))].join("\n");
    const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv"})),download:"ontario_mental_health_services.csv"});
    a.click();
  };

  const PIE_TOOLTIP_STYLE = {
    fontSize:12, border:"1px solid var(--color-border)",
    borderRadius:"var(--radius-md)", boxShadow:"var(--shadow-card)",
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--color-bg)" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        background:"var(--color-surface)",
        borderBottom:"1px solid var(--color-border)",
        padding:"0 var(--space-8)",
        height:52,
        position:"sticky", top:0, zIndex:10,
        display:"flex", alignItems:"center",
      }}>
        <div style={{ maxWidth:1400, width:"100%", margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:6, background:"var(--color-accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="7" width="3" height="8" fill="white" rx="0.5"/>
                <rect x="6" y="4" width="3" height="11" fill="white" rx="0.5"/>
                <rect x="11" y="1" width="3" height="14" fill="white" rx="0.5"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize:14, fontWeight:700, color:"var(--color-text-primary)", margin:0, lineHeight:1.3 }}>
                Ontario Mental Health Services
              </h1>
              <p style={{ fontSize:11, color:"var(--color-text-muted)", margin:0 }}>
                KHP 2019 MOH Export · {kpis?.totalServices?.toLocaleString() ?? "5,945"} records
              </p>
            </div>
          </div>

          <div style={{ display:"flex", background:"var(--color-bg)", border:"1px solid var(--color-border)", borderRadius:6, padding:2, gap:2 }}>
            {(["charts","report"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:"5px 16px", fontSize:12, fontWeight:500,
                border:"none", borderRadius:4, cursor:"pointer",
                transition:"all var(--duration-fast) var(--ease-out)",
                background:tab===t?"var(--color-surface)":"transparent",
                color:tab===t?"var(--color-text-primary)":"var(--color-text-muted)",
                boxShadow:tab===t?"var(--shadow-card)":"none",
              }}>
                {t==="charts" ? "Overview" : "Service Report"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div style={{ background:"var(--color-surface)", borderBottom:"1px solid var(--color-border-subtle)", padding:"8px var(--space-8)" }}>
        <div style={{ maxWidth:1400, margin:"0 auto", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>

          <Sel value={filters.county??""} onChange={v=>set("county",v)}
            options={counties as string[]} placeholder="All Counties" width={148} />

          <Sel value={filters.taxonomyTerm??""} onChange={v=>set("taxonomyTerm",v)}
            options={taxTerms as string[]} placeholder="All Categories" width={220} />

          <Sel value={filters.ageGroup??""} onChange={v=>set("ageGroup",v)}
            options={AGE_GROUPS} placeholder="Any Age Group" width={168} />

          <Sel value={filters.gender??""} onChange={v=>set("gender",v)}
            options={GENDER_GROUPS} placeholder="Any Gender" width={128} />

          <div style={{ width:1, height:20, background:"var(--color-border)", margin:"0 4px", flexShrink:0 }} />

          <Toggle label="Bilingual"     active={filters.bilingual==="true"}     onChange={v=>set("bilingual",v?"true":undefined)} />
          <Toggle label="LGBTQ+"        active={filters.lgbtq==="true"}         onChange={v=>set("lgbtq",v?"true":undefined)} />
          <Toggle label="Harm Reduction" active={filters.harmReduction==="true"} onChange={v=>set("harmReduction",v?"true":undefined)} />

          {activeCount > 0 && (
            <button onClick={clear} style={{
              fontSize:11, color:"var(--color-text-muted)",
              background:"none", border:"none", cursor:"pointer",
              textDecoration:"underline", padding:"0 4px", marginLeft:2,
            }}>
              Clear ({activeCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth:1400, margin:"0 auto", padding:"var(--space-6) var(--space-8) var(--space-8)" }}>

        {/* KPIs */}
        <section style={{ marginBottom:"var(--space-6)" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px,1fr))", gap:"var(--space-4)" }}>
            {kpiL ? (
              [0,1,2,3,4].map(i => <KpiSkeleton key={i} />)
            ) : (
              <>
                <KpiCard label="Total Services"   value={kpis?.totalServices}         sub="Matching current filters"     delay={0}   />
                <KpiCard label="Counties"         value={kpis?.totalCounties}         sub="Geographic regions covered"   delay={50}  />
                <KpiCard label="Bilingual"        value={kpis?.bilingualServices}     sub="EN/FR service delivery"       delay={100} />
                <KpiCard label="LGBTQ+ Affirming" value={kpis?.lgbtqServices}         sub="Inclusive support services"   delay={150} />
                <KpiCard label="Harm Reduction"   value={kpis?.harmReductionServices} sub="Harm reduction approach"      delay={200} />
              </>
            )}
          </div>
        </section>

        {/* ── Overview tab ─────────────────────────────────────────────── */}
        {tab === "charts" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"var(--space-5)" }}>

            {/* Row 1: Category + County */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--space-5)" }}>

              <div className="card animate-in" style={{ padding:"var(--space-5)", animationDelay:"150ms" }}>
                <SectionHeader
                  title="Services by Category"
                  note="Top 12 service types grouped by taxonomy category" />
                {catL ? <ChartSkeleton height={340} /> : (
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={byCat} layout="vertical" margin={{ left:4, right:24, top:2, bottom:2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:11, fill:"#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category" dataKey="category" width={190}
                        tick={{ fontSize:10, fill:"#475569" }} axisLine={false} tickLine={false}
                        tickFormatter={(v:string) => v.length>32 ? v.slice(0,30)+"…" : v} />
                      <Tooltip content={<TTip />} cursor={{ fill:"#f8fafc" }} />
                      <Bar dataKey="count" radius={[0,3,3,0]} maxBarSize={18}>
                        {byCat.map((_:unknown,i:number) => <Cell key={i} fill={CHART_BLUE[i%CHART_BLUE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card animate-in" style={{ padding:"var(--space-5)", animationDelay:"200ms" }}>
                <SectionHeader
                  title="Services by County"
                  note="Top 20 Ontario counties by total service volume" />
                {ctyL ? <ChartSkeleton height={340} /> : (
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={byCty} layout="vertical" margin={{ left:4, right:24, top:6, bottom:2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:11, fill:"#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="county" width={100}
                        tick={{ fontSize:11, fill:"#475569" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<TTip />} cursor={{ fill:"#f8fafc" }} />
                      <Bar dataKey="count" radius={[0,3,3,0]} maxBarSize={14}>
                        {byCty.map((_:unknown,i:number) => <Cell key={i} fill={CHART_BLUE[i%CHART_BLUE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Row 2: Age + Gender + Language */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"var(--space-5)" }}>

              <div className="card animate-in" style={{ padding:"var(--space-5)", animationDelay:"250ms" }}>
                <SectionHeader title="Age Eligibility" note="Services by declared age group" />
                {ageL ? <ChartSkeleton height={220} /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byAge} margin={{ left:0, right:12, top:4, bottom:52 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="ageGroup" tick={{ fontSize:10, fill:"#475569" }} axisLine={false} tickLine={false}
                        angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize:11, fill:"#94a3b8" }} axisLine={false} tickLine={false} width={34} />
                      <Tooltip content={<TTip />} cursor={{ fill:"#f8fafc" }} />
                      <Bar dataKey="count" radius={[3,3,0,0]} fill="#1d4ed8" maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card animate-in" style={{ padding:"var(--space-5)", animationDelay:"300ms" }}>
                <SectionHeader title="Gender Eligibility" note="Services by declared gender eligibility" />
                {genL ? (
                  <div style={{ height:220, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div className="skeleton" style={{ width:130, height:130, borderRadius:"50%" }} />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={byGen} dataKey="count" nameKey="gender"
                        cx="50%" cy="42%" outerRadius={74} innerRadius={38} paddingAngle={3}>
                        {byGen.map((_:unknown,i:number) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend
                        formatter={(v:string) => <span style={{ fontSize:11, color:"#475569" }}>{v}</span>}
                        iconSize={8} />
                      <Tooltip formatter={(v:number) => [v.toLocaleString(),"Services"]} contentStyle={PIE_TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card animate-in" style={{ padding:"var(--space-5)", animationDelay:"350ms" }}>
                <SectionHeader title="Language Availability" note="Bilingual (EN/FR) vs. single-language delivery" />
                {lanL ? (
                  <div style={{ height:220, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div className="skeleton" style={{ width:130, height:130, borderRadius:"50%" }} />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={byLan} dataKey="count" nameKey="language"
                        cx="50%" cy="42%" outerRadius={74} innerRadius={38} paddingAngle={3}>
                        {byLan.map((_:unknown,i:number) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend
                        formatter={(v:string) => <span style={{ fontSize:11, color:"#475569" }}>{v}</span>}
                        iconSize={8} />
                      <Tooltip formatter={(v:number) => [v.toLocaleString(),"Services"]} contentStyle={PIE_TOOLTIP_STYLE} />
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
                <h2 style={{ fontSize:15, fontWeight:600, margin:0, color:"var(--color-text-primary)" }}>Service Records</h2>
                <p style={{ fontSize:11, color:"var(--color-text-muted)", margin:"3px 0 0" }}>
                  {rptL ? "Loading…" : `${rpt.length.toLocaleString()} records${rpt.length===500?" · showing first 500":""}`}
                </p>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input
                  type="text" value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search service name…"
                  style={{ padding:"6px 10px", fontSize:12, border:"1px solid var(--color-border)", borderRadius:"var(--radius-sm)", outline:"none", width:220, background:"var(--color-surface)", color:"var(--color-text-primary)" }} />
                <button
                  onClick={exportCsv} disabled={!rpt.length}
                  style={{ padding:"6px 16px", fontSize:12, fontWeight:500, border:"none", borderRadius:"var(--radius-sm)", background:"var(--color-accent)", color:"white", cursor:rpt.length?"pointer":"not-allowed", opacity:rpt.length?1:0.5 }}>
                  Export CSV
                </button>
              </div>
            </div>

            <div className="card" style={{ overflow:"hidden", padding:0 }}>
              {rptL ? (
                <div style={{ padding:"var(--space-8)", display:"flex", flexDirection:"column", gap:14 }}>
                  {[0,1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="skeleton" style={{ height:16, width:i%3===0?"45%":"75%", borderRadius:"var(--radius-sm)" }} />
                  ))}
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ background:"var(--color-bg)", borderBottom:"2px solid var(--color-border)" }}>
                        {["Service Name","Category","City","County","Age Group","Gender","Languages","Bilingual","LGBTQ+","Harm Red.","Wait Time"].map(h => (
                          <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontWeight:600, color:"var(--color-text-muted)", letterSpacing:"0.04em", textTransform:"uppercase", fontSize:10, whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rpt.length===0 ? (
                        <tr><td colSpan={11} style={{ padding:"var(--space-8)", textAlign:"center", color:"var(--color-text-muted)", fontSize:13 }}>No records match the current filters.</td></tr>
                      ) : rpt.map((row, i) => (
                        <tr key={row.id}
                          style={{ borderBottom:"1px solid var(--color-border-subtle)", background:i%2===0?"var(--color-surface)":"var(--color-bg)", transition:"background var(--duration-fast)" }}
                          onMouseEnter={e => (e.currentTarget.style.background="var(--color-accent-light)")}
                          onMouseLeave={e => (e.currentTarget.style.background=i%2===0?"var(--color-surface)":"var(--color-bg)")}>
                          <td style={{ padding:"8px 12px", maxWidth:220 }}>
                            <div style={{ fontWeight:500, color:"var(--color-text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {row.publicName || row.officialName || "—"}
                            </div>
                            {row.websiteAddress && (
                              <a href={row.websiteAddress} target="_blank" rel="noopener noreferrer"
                                style={{ color:"var(--color-accent)", textDecoration:"none", fontSize:10 }}>
                                Website ↗
                              </a>
                            )}
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
                          <td style={{ padding:"8px 12px", maxWidth:160 }}>
                            <span style={{ color:"var(--color-text-secondary)", overflow:"hidden", textOverflow:"ellipsis", display:"block", whiteSpace:"nowrap" }}>{row.normalWaitTime||"—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop:"1px solid var(--color-border-subtle)", padding:"var(--space-4) var(--space-8)", textAlign:"center", fontSize:11, color:"var(--color-text-muted)" }}>
        Data source: Kids Help Phone: Ontario Ministry of Health Export 2019 · For internal analytics use only
      </footer>
    </div>
  );
}
