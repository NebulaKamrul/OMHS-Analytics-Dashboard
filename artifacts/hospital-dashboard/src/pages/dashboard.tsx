import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CSVLink } from "react-csv";
import { format } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Calendar, RefreshCw, ChevronDown, Check,
  Sun, Moon, Download, Printer, ArrowUp, ArrowDown, Building2
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

import {
  useGetDepartments,
  useGetDashboardKpis,
  useGetAdmissionsByMonth,
  useGetAppointmentsByDepartment,
  useGetOccupancyByDepartment,
  useGetAvgLengthOfStay,
  useGetDischargeTrends,
  useGetDashboardReport,
} from "@workspace/api-client-react";

const CHART_COLORS = {
  blue: "#0079F2",
  purple: "#795EFF",
  green: "#009118",
  red: "#A60808",
  pink: "#ec4899",
};

const CHART_COLOR_LIST = [
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.green,
  CHART_COLORS.red,
  CHART_COLORS.pink,
];

// --- Custom Tooltips & Legends ---
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "6px",
        padding: "10px 14px",
        border: "1px solid #e0e0e0",
        color: "#1a1a1a",
        fontSize: "13px",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      }}
    >
      <div style={{ marginBottom: "6px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
        {payload.length === 1 && payload[0].color && payload[0].color !== "#ffffff" && (
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", backgroundColor: payload[0].color, flexShrink: 0 }} />
        )}
        {label}
      </div>
      {payload.map((entry: any, index: number) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
          {payload.length > 1 && entry.color && entry.color !== "#ffffff" && (
            <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", backgroundColor: entry.color, flexShrink: 0 }} />
          )}
          <span style={{ color: "#444" }}>{entry.name}</span>
          <span style={{ marginLeft: "auto", fontWeight: 600 }}>
            {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ payload }: any) {
  if (!payload || payload.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 16px", fontSize: "13px" }}>
      {payload.map((entry: any, index: number) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", backgroundColor: entry.color, flexShrink: 0 }} />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// --- Data Table ---
function DataTable<T>({ data, columns }: { data: T[]; columns: ColumnDef<T>[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search all columns..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} onClick={header.column.getToggleSortingHandler()} className="cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " 🔼", desc: " 🔽" }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
          {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "}
          of {table.getFilteredRowModel().rows.length} results
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
        </div>
      </div>
    </div>
  );
}

// --- Main Dashboard ---
export default function Dashboard() {
  const queryClient = useQueryClient();
  const [isDark, setIsDark] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIntervalMs, setSelectedIntervalMs] = useState(5 * 60 * 1000);
  
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(2024, 0, 1),
    to: new Date(2025, 5, 30)
  });
  const [departmentId, setDepartmentId] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const queryParams = useMemo(() => ({
    startDate: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
    endDate: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
    departmentId: departmentId ?? undefined,
  }), [dateRange, departmentId]);

  // Data fetching
  const { data: depts } = useGetDepartments();
  const kpisQuery = useGetDashboardKpis(queryParams, { query: { queryKey: ['kpis', queryParams] } });
  const admissionsQuery = useGetAdmissionsByMonth(queryParams, { query: { queryKey: ['admissions', queryParams] } });
  const appointmentsQuery = useGetAppointmentsByDepartment(queryParams, { query: { queryKey: ['appointments', queryParams] } });
  const occupancyQuery = useGetOccupancyByDepartment(queryParams, { query: { queryKey: ['occupancy', queryParams] } });
  const avgLosQuery = useGetAvgLengthOfStay(queryParams, { query: { queryKey: ['avgLos', queryParams] } });
  const dischargesQuery = useGetDischargeTrends(queryParams, { query: { queryKey: ['discharges', queryParams] } });
  const reportQuery = useGetDashboardReport(queryParams, { query: { queryKey: ['report', queryParams] } });

  const loading = 
    kpisQuery.isLoading || kpisQuery.isFetching ||
    admissionsQuery.isLoading || admissionsQuery.isFetching ||
    appointmentsQuery.isLoading || appointmentsQuery.isFetching ||
    occupancyQuery.isLoading || occupancyQuery.isFetching ||
    avgLosQuery.isLoading || avgLosQuery.isFetching ||
    dischargesQuery.isLoading || dischargesQuery.isFetching ||
    reportQuery.isLoading || reportQuery.isFetching;

  useEffect(() => {
    if (loading) {
      setIsSpinning(true);
    } else {
      const t = setTimeout(() => setIsSpinning(false), 600);
      return () => clearTimeout(t);
    }
  }, [loading]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries();
    }, selectedIntervalMs);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedIntervalMs, queryClient]);

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  const INTERVAL_OPTIONS = [
    { label: "Every 5 min", ms: 5 * 60 * 1000 },
    { label: "Every 15 min", ms: 15 * 60 * 1000 },
    { label: "Every 1 hour", ms: 60 * 60 * 1000 },
  ];

  const lastRefreshed = kpisQuery.dataUpdatedAt
    ? new Date(kpisQuery.dataUpdatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase() + " on " + new Date(kpisQuery.dataUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  const btnBg = isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2";
  const btnColor = isDark ? "#c8c9cc" : "#4b5563";

  const reportColumns: ColumnDef<any>[] = [
    { accessorKey: "admissionId", header: "ID", cell: ({ row }) => <span className="font-mono text-sm">{row.original.admissionId}</span> },
    { accessorKey: "patientName", header: "Patient Name" },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "admissionDate", header: "Admission Date", cell: ({ row }) => new Date(row.original.admissionDate).toLocaleDateString() },
    { accessorKey: "dischargeDate", header: "Discharge Date", cell: ({ row }) => row.original.dischargeDate ? new Date(row.original.dischargeDate).toLocaleDateString() : "-" },
    { accessorKey: "lengthOfStay", header: "Length of Stay (Days)", cell: ({ row }) => row.original.lengthOfStay ?? "-" },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const colorClass = status === 'discharged' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        return <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${colorClass}`}>{status}</span>;
      }
    }
  ];

  return (
    <div className="min-h-screen bg-background px-5 py-4 pt-[32px] pb-[32px] pl-[24px] pr-[24px]">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
          <div className="pt-2">
            <h1 className="font-bold text-[32px] tracking-tight">Ontario Shores</h1>
            <p className="text-muted-foreground mt-1.5 text-[14px]">Hospital Operations Dashboard</p>
            {lastRefreshed && <p className="text-[12px] text-muted-foreground mt-3">Last refresh: {lastRefreshed}</p>}
          </div>
          <div className="flex items-center flex-wrap gap-3 pt-2">
            
            {/* Filters */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[260px] justify-start text-left font-normal bg-card">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRange.from && dateRange.to ? (
                      <>{format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}</>
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={dateRange as any}
                    onSelect={(range: any) => { if (range) setDateRange(range); }}
                  />
                </PopoverContent>
              </Popover>

              <Select value={departmentId ? departmentId.toString() : "all"} onValueChange={(v) => setDepartmentId(v === "all" ? null : parseInt(v))}>
                <SelectTrigger className="w-[200px] bg-card">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground"/>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {depts?.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 print:hidden">
              <div className="relative" ref={dropdownRef}>
                <div className="flex items-center rounded-[6px] overflow-hidden h-[36px] text-[13px] font-medium" style={{ backgroundColor: btnBg, color: btnColor }}>
                  <button onClick={handleRefresh} disabled={loading} className="flex items-center gap-2 px-3 h-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${isSpinning ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  <div className="w-px h-5 shrink-0" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" }} />
                  <button onClick={() => setDropdownOpen((o) => !o)} className="flex items-center justify-center px-2 h-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                {dropdownOpen && (
                  <div className="absolute right-0 top-[calc(100%+4px)] w-48 bg-popover border rounded-md shadow-lg p-1 z-50 text-[13px]">
                    <div className="flex items-center justify-between p-2 border-b mb-1">
                      <span className="font-medium">Auto-refresh</span>
                      <button 
                        className={`w-8 h-4 rounded-full relative transition-colors ${autoRefresh ? 'bg-primary' : 'bg-muted'}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoRefresh ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>
                    {INTERVAL_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => { setSelectedIntervalMs(opt.ms); setAutoRefresh(true); setDropdownOpen(false); }}
                        className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-sm transition-colors"
                      >
                        <span>{opt.label}</span>
                        {selectedIntervalMs === opt.ms && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => window.print()}
                disabled={loading}
                className="flex items-center justify-center w-[36px] h-[36px] rounded-[6px] transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: btnBg, color: btnColor }}
                aria-label="Export as PDF"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsDark((d) => !d)}
                className="flex items-center justify-center w-[36px] h-[36px] rounded-[6px] transition-colors hover:opacity-80"
                style={{ backgroundColor: btnBg, color: btnColor }}
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-5">
              {loading ? (
                <><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-20" /></>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-medium">Total Admissions</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: CHART_COLORS.blue }}>{kpisQuery.data?.totalAdmissions.toLocaleString()}</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              {loading ? (
                <><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-20" /></>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-medium">Avg Length of Stay</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: CHART_COLORS.blue }}>{kpisQuery.data?.avgLengthOfStay.toFixed(1)} <span className="text-base font-normal text-muted-foreground">days</span></p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              {loading ? (
                <><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-20" /></>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-medium">Bed Occupancy</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: CHART_COLORS.blue }}>{kpisQuery.data?.bedOccupancyRate.toFixed(1)}%</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              {loading ? (
                <><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-20" /></>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-medium">Staff : Patient</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: CHART_COLORS.blue }}>{kpisQuery.data?.staffPatientRatio.toFixed(2)}</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              {loading ? (
                <><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-20" /></>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-medium">Total Discharges</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: CHART_COLORS.green }}>{kpisQuery.data?.totalDischarges.toLocaleString()}</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              {loading ? (
                <><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-20" /></>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-medium">Total Appointments</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: CHART_COLORS.blue }}>{kpisQuery.data?.totalAppointments.toLocaleString()}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="px-5 pt-5 pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Admissions Trend</CardTitle>
              {!loading && admissionsQuery.data && admissionsQuery.data.length > 0 && (
                <CSVLink data={admissionsQuery.data} filename="admissions-trend.csv" className="print:hidden flex items-center justify-center w-[28px] h-[28px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: btnBg, color: btnColor }} aria-label="Export CSV">
                  <Download className="w-3.5 h-3.5" />
                </CSVLink>
              )}
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-5">
              {loading ? <Skeleton className="w-full h-[300px]" /> : admissionsQuery.data && admissionsQuery.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={300} debounce={0}>
                  <AreaChart data={admissionsQuery.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientAdmissions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} tickMargin={10} />
                    <YAxis tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} tickMargin={10} />
                    <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(0,0,0,0.05)', stroke: 'none' }} />
                    <Area type="monotone" dataKey="admissions" name="Admissions" fill="url(#gradientAdmissions)" stroke={CHART_COLORS.blue} fillOpacity={1} strokeWidth={2} activeDot={{ r: 5, fill: CHART_COLORS.blue, stroke: '#ffffff', strokeWidth: 3 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-5 pt-5 pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Weekly Discharges</CardTitle>
              {!loading && dischargesQuery.data && dischargesQuery.data.length > 0 && (
                <CSVLink data={dischargesQuery.data} filename="weekly-discharges.csv" className="print:hidden flex items-center justify-center w-[28px] h-[28px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: btnBg, color: btnColor }} aria-label="Export CSV">
                  <Download className="w-3.5 h-3.5" />
                </CSVLink>
              )}
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-5">
              {loading ? <Skeleton className="w-full h-[300px]" /> : dischargesQuery.data && dischargesQuery.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={300} debounce={0}>
                  <LineChart data={dischargesQuery.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} tickMargin={10} />
                    <YAxis tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} tickMargin={10} />
                    <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ stroke: tickColor, strokeDasharray: '3 3' }} />
                    <Line type="monotone" dataKey="discharges" name="Discharges" stroke={CHART_COLORS.green} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: CHART_COLORS.green, stroke: '#ffffff', strokeWidth: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-1">
            <CardHeader className="px-5 pt-5 pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Bed Occupancy Rate</CardTitle>
              {!loading && occupancyQuery.data && occupancyQuery.data.length > 0 && (
                <CSVLink data={occupancyQuery.data} filename="occupancy-by-department.csv" className="print:hidden flex items-center justify-center w-[28px] h-[28px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: btnBg, color: btnColor }} aria-label="Export CSV">
                  <Download className="w-3.5 h-3.5" />
                </CSVLink>
              )}
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-5">
              {loading ? <Skeleton className="w-full h-[250px]" /> : occupancyQuery.data && occupancyQuery.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250} debounce={0}>
                  <BarChart data={occupancyQuery.data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <YAxis type="category" dataKey="department" tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} width={80} />
                    <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} cursor={false} />
                    <Bar dataKey="occupancyRate" name="Occupancy Rate" fill={CHART_COLORS.blue} fillOpacity={0.8} activeBar={{ fillOpacity: 1 }} isAnimationActive={false} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader className="px-5 pt-5 pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Appointments by Dept</CardTitle>
              {!loading && appointmentsQuery.data && appointmentsQuery.data.length > 0 && (
                <CSVLink data={appointmentsQuery.data} filename="appointments-by-department.csv" className="print:hidden flex items-center justify-center w-[28px] h-[28px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: btnBg, color: btnColor }} aria-label="Export CSV">
                  <Download className="w-3.5 h-3.5" />
                </CSVLink>
              )}
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-5">
              {loading ? <Skeleton className="w-full h-[250px]" /> : appointmentsQuery.data && appointmentsQuery.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250} debounce={0}>
                  <BarChart data={appointmentsQuery.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="department" tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} tickMargin={10} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} tickMargin={10} />
                    <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                    <Legend content={<CustomLegend />} />
                    <Bar dataKey="completed" stackId="a" name="Completed" fill={CHART_COLORS.blue} fillOpacity={0.9} isAnimationActive={false} />
                    <Bar dataKey="cancelled" stackId="a" name="Cancelled" fill={CHART_COLORS.red} fillOpacity={0.7} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader className="px-5 pt-5 pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Avg Length of Stay</CardTitle>
              {!loading && avgLosQuery.data && avgLosQuery.data.length > 0 && (
                <CSVLink data={avgLosQuery.data} filename="avg-length-of-stay.csv" className="print:hidden flex items-center justify-center w-[28px] h-[28px] rounded-[6px] transition-colors hover:opacity-80" style={{ backgroundColor: btnBg, color: btnColor }} aria-label="Export CSV">
                  <Download className="w-3.5 h-3.5" />
                </CSVLink>
              )}
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-5">
              {loading ? <Skeleton className="w-full h-[250px]" /> : avgLosQuery.data && avgLosQuery.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250} debounce={0}>
                  <BarChart data={avgLosQuery.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="department" tick={{ fontSize: 11, fill: tickColor }} stroke={tickColor} tickMargin={10} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} tickMargin={10} />
                    <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                    <Bar dataKey="avgDays" name="Avg Days" fill={CHART_COLORS.purple} fillOpacity={0.8} activeBar={{ fillOpacity: 1 }} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabular Report */}
        <Card className="mb-8">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base font-semibold">Admissions Report</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : reportQuery.data ? (
              <DataTable data={reportQuery.data} columns={reportColumns} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
