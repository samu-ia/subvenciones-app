"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Database, RefreshCw, Play, CheckCircle2, Clock, AlertCircle,
  ExternalLink, ChevronLeft, ChevronRight, Search, Loader2,
  Settings, X, Brain, Zap, Download, FileText, Save, Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AIConfigPanel from "@/components/workspace/ai/AIConfigPanel";

interface Subvencion {
  id: string;
  bdns_id: string;
  titulo: string;
  organismo?: string;
  estado_convocatoria: string;
  pipeline_estado: string;
  ia_confidence?: number;
  fecha_publicacion?: string;
  plazo_fin?: string;
  importe_maximo?: number;
  porcentaje_financiacion?: number;
  resumen_ia?: string;
  para_quien?: string;
  url_oficial?: string;
  updated_at: string;
}

interface IngestaLog {
  id: string;
  fecha_ingesta: string;
  estado: string;
  nuevas: number;
  actualizadas: number;
  sin_cambios: number;
  errores: number;
  duracion_ms?: number;
}

interface PipelineConfig {
  limite_diario: number;
  dias_atras: number;
  descargar_pdfs: boolean;
  extraer_texto: boolean;
  analizar_con_ia: boolean;
  max_paginas_pdf: number;
  modelo_ia: string;
}

const CONFIG_DEFAULT: PipelineConfig = {
  limite_diario: 30,
  dias_atras: 1,
  descargar_pdfs: true,
  extraer_texto: true,
  analizar_con_ia: true,
  max_paginas_pdf: 50,
  modelo_ia: "",
};

const STORAGE_KEY = "subvenciones_pipeline_config";

const ESTADOS_CONV: Record<string, { label: string; color: string }> = {
  abierta:     { label: "Abierta",    color: "#22c55e" },
  cerrada:     { label: "Cerrada",    color: "#94a3b8" },
  proxima:     { label: "Próxima",    color: "#f59e0b" },
  suspendida:  { label: "Suspendida", color: "#ef4444" },
  resuelta:    { label: "Resuelta",   color: "#8b5cf6" },
  desconocido: { label: "?",          color: "#94a3b8" },
};

const PIPELINE_ESTADOS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  normalizado:    { label: "✓ Completo",     color: "#22c55e", icon: <CheckCircle2 size={12} /> },
  ia_procesado:   { label: "IA procesado",   color: "#3b82f6", icon: <CheckCircle2 size={12} /> },
  texto_extraido: { label: "Texto extraído", color: "#8b5cf6", icon: <Clock size={12} /> },
  pdf_descargado: { label: "PDF ok",         color: "#f59e0b", icon: <Clock size={12} /> },
  raw:            { label: "Raw BDNS",       color: "#94a3b8", icon: <Clock size={12} /> },
  error:          { label: "Error",          color: "#ef4444", icon: <AlertCircle size={12} /> },
};

function formatEuros(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n} €`;
}
function formatDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}
function formatDuracion(ms?: number) {
  if (!ms) return "";
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}
function loadConfig(): PipelineConfig {
  if (typeof window === "undefined") return CONFIG_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...CONFIG_DEFAULT, ...JSON.parse(raw) } : CONFIG_DEFAULT;
  } catch { return CONFIG_DEFAULT; }
}

export default function SubvencionsBdPage() {
  const [subvenciones, setSubvenciones] = useState<Subvencion[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ingestando, setIngestando] = useState(false);
  const [logs, setLogs] = useState<IngestaLog[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPipeline, setFiltroPipeline] = useState("");
  const [expandida, setExpandida] = useState<string | null>(null);
  const [feedbackIngesta, setFeedbackIngesta] = useState<string | null>(null);

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [tabPanel, setTabPanel] = useState<"pipeline" | "ia">("pipeline");
  const [config, setConfig] = useState<PipelineConfig>(CONFIG_DEFAULT);
  const [configGuardada, setConfigGuardada] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [proveedorActivo, setProveedorActivo] = useState<string | null>(null);

  const tamanio = 20;

  useEffect(() => {
    setConfig(loadConfig());
    const sb = createClient();
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data } = await sb
        .from("ia_providers")
        .select("provider")
        .eq("enabled", true)
        .not("api_key", "is", null)
        .limit(1)
        .maybeSingle();
      setProveedorActivo(data?.provider ?? null);
    });
  }, []);

  const cargarSubvenciones = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pagina: String(pagina), tamanio: String(tamanio),
        ...(busqueda && { q: busqueda }),
        ...(filtroEstado && { estado: filtroEstado }),
        ...(filtroPipeline && { pipeline: filtroPipeline }),
      });
      const res = await fetch(`/api/subvenciones/catalogo?${params}`);
      const data = await res.json();
      setSubvenciones(data.data ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  }, [pagina, busqueda, filtroEstado, filtroPipeline]);

  const cargarLogs = useCallback(async () => {
    const res = await fetch("/api/subvenciones/ingesta-log");
    const data = await res.json();
    setLogs(data.data ?? []);
  }, []);

  useEffect(() => { cargarSubvenciones(); }, [cargarSubvenciones]);
  useEffect(() => { cargarLogs(); }, [cargarLogs]);

  const lanzarIngesta = async () => {
    if (ingestando) return;
    setIngestando(true);
    setFeedbackIngesta("Consultando BDNS...");
    try {
      const cfg = loadConfig();
      const body: Record<string, unknown> = {
        limite: cfg.limite_diario,
        soloNuevas: true,
        descargarPdfs: cfg.descargar_pdfs,
        extraerTexto: cfg.extraer_texto,
        analizarConIa: cfg.analizar_con_ia,
      };
      const diasAtras = cfg.dias_atras;
      if (diasAtras > 0) {
        const hoy = new Date();
        const desde = new Date(hoy);
        desde.setDate(desde.getDate() - diasAtras);
        body.fechaHasta = hoy.toISOString().split("T")[0];
        body.fechaDesde = desde.toISOString().split("T")[0];
      }
      setFeedbackIngesta(`Procesando convocatorias (máx. ${cfg.limite_diario})…`);
      const res = await fetch("/api/subvenciones/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        const r = data.resultado;
        setFeedbackIngesta(
          `✅ ${r?.nuevas ?? 0} nuevas · ${r?.actualizadas ?? 0} actualizadas · ${r?.errores ?? 0} errores` +
          (r?.duracion_ms ? ` · ${formatDuracion(r.duracion_ms)}` : "")
        );
        await cargarSubvenciones();
        await cargarLogs();
      } else {
        setFeedbackIngesta(`❌ ${data.error}`);
      }
    } catch {
      setFeedbackIngesta("❌ Error de red");
    } finally {
      setIngestando(false);
      setTimeout(() => setFeedbackIngesta(null), 10000);
    }
  };

  const guardarConfig = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setConfigGuardada(true);
    setTimeout(() => setConfigGuardada(false), 2000);
  };

  const updateConfig = (f: Partial<PipelineConfig>) => setConfig(c => ({ ...c, ...f }));
  const totalPaginas = Math.ceil(total / tamanio);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: "calc(100vh - 60px)" }}>

      {/* ── Contenido principal ── */}
      <div style={{ flex: 1, padding: "28px 32px", overflow: "auto", minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Database size={22} color="var(--blue)" />
            <div>
              <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
                Catálogo BDNS
              </h1>
              <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "2px 0 0" }}>
                {total.toLocaleString()} subvenciones · PDFs como fuente de verdad
                {proveedorActivo && <span style={{ marginLeft: 8, color: "#22c55e" }}>· IA: {proveedorActivo}</span>}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cargarSubvenciones} disabled={loading} style={btnSec}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
            </button>
            <button
              onClick={() => { setPanelAbierto(p => !p); setTabPanel("pipeline"); }}
              style={{ ...btnSec, background: panelAbierto ? "var(--blue-bg)" : "var(--surface)", color: panelAbierto ? "var(--blue)" : "var(--ink2)", borderColor: panelAbierto ? "var(--blue)" : "var(--border)" }}
            >
              <Settings size={14} /> Ajustes
            </button>
            <button onClick={lanzarIngesta} disabled={ingestando} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8,
              border: "none", background: ingestando ? "var(--blue-bg)" : "var(--blue)",
              color: ingestando ? "var(--blue)" : "#fff", fontSize: "0.82rem",
              cursor: ingestando ? "not-allowed" : "pointer", fontWeight: 600, fontFamily: "inherit",
            }}>
              {ingestando ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {ingestando ? "Ingestando..." : "Lanzar ingesta"}
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedbackIngesta && (
          <div style={{
            padding: "10px 16px", borderRadius: 8, marginBottom: 14,
            background: feedbackIngesta.startsWith("✅") ? "#f0fdf4" : feedbackIngesta.startsWith("❌") ? "#fef2f2" : "#eff6ff",
            border: `1px solid ${feedbackIngesta.startsWith("✅") ? "#bbf7d0" : feedbackIngesta.startsWith("❌") ? "#fecaca" : "#bfdbfe"}`,
            fontSize: "0.83rem", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 8,
          }}>
            {ingestando && <Loader2 size={13} className="animate-spin" />}
            {feedbackIngesta}
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {logs.slice(0, 3).map(log => (
              <div key={log.id} style={{
                padding: "7px 12px", borderRadius: 8, background: "var(--surface)",
                border: "1px solid var(--border)", fontSize: "0.77rem", color: "var(--ink2)",
                display: "flex", gap: 7, alignItems: "center",
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: log.estado === "completado" ? "#22c55e" : log.estado === "error" ? "#ef4444" : log.estado === "parcial" ? "#f59e0b" : "#3b82f6",
                }} />
                <span style={{ fontWeight: 600 }}>{formatDate(log.fecha_ingesta)}</span>
                <span>{log.nuevas} nuevas · {log.actualizadas} act. · {log.errores} err.</span>
                {log.duracion_ms && <span style={{ color: "var(--muted)" }}>{formatDuracion(log.duracion_ms)}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              placeholder="Buscar por título, organismo..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
              style={{ ...inputSt, paddingLeft: 32, width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1); }} style={selectSt}>
            <option value="">Todos los estados</option>
            <option value="abierta">Abierta</option>
            <option value="proxima">Próxima</option>
            <option value="cerrada">Cerrada</option>
            <option value="resuelta">Resuelta</option>
          </select>
          <select value={filtroPipeline} onChange={e => { setFiltroPipeline(e.target.value); setPagina(1); }} style={selectSt}>
            <option value="">Todo el pipeline</option>
            <option value="normalizado">Normalizado ✓</option>
            <option value="ia_procesado">IA procesado</option>
            <option value="pdf_descargado">PDF descargado</option>
            <option value="raw">Solo raw</option>
            <option value="error">Con errores</option>
          </select>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: "var(--muted)" }}>
            <Loader2 size={20} className="animate-spin" style={{ marginRight: 10 }} /> Cargando...
          </div>
        ) : subvenciones.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--surface)", borderRadius: 12, border: "1px dashed var(--border)", color: "var(--muted)" }}>
            <Database size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ fontWeight: 600, margin: "0 0 6px" }}>Sin subvenciones</p>
            <p style={{ fontSize: "0.83rem", margin: 0 }}>
              {busqueda || filtroEstado ? "Sin resultados para los filtros." : "Pulsa \"Lanzar ingesta\" para traer convocatorias de BDNS."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {subvenciones.map(s => {
              const ec = ESTADOS_CONV[s.estado_convocatoria] ?? ESTADOS_CONV.desconocido;
              const ep = PIPELINE_ESTADOS[s.pipeline_estado] ?? PIPELINE_ESTADOS.raw;
              const open = expandida === s.id;
              return (
                <div key={s.id} style={{ background: "var(--surface)", borderRadius: 10, border: `1px solid ${open ? "var(--blue)" : "var(--border)"}`, overflow: "hidden" }}>
                  <div onClick={() => setExpandida(open ? null : s.id)} style={{
                    padding: "11px 16px", cursor: "pointer",
                    display: "grid", gridTemplateColumns: "1fr 170px 85px 80px 80px", gap: 12, alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, marginBottom: 2 }}>
                        {s.titulo || `Convocatoria ${s.bdns_id}`}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{s.organismo ?? "—"} · BDNS {s.bdns_id}</div>
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: ec.color + "20", color: ec.color }}>{ec.label}</span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: ep.color + "18", color: ep.color, display: "flex", alignItems: "center", gap: 3 }}>
                        {ep.icon} {ep.label}
                      </span>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink)" }}>
                      {formatEuros(s.importe_maximo)}
                      {s.porcentaje_financiacion && <div style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--muted)" }}>{s.porcentaje_financiacion}%</div>}
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.78rem", color: "var(--muted)" }}>
                      {s.plazo_fin ? <><div style={{ fontWeight: 600, color: "var(--ink2)" }}>Hasta</div>{formatDate(s.plazo_fin)}</> : "—"}
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--muted)" }}>
                      {s.ia_confidence != null ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ width: `${(s.ia_confidence * 100).toFixed(0)}%`, height: "100%", background: s.ia_confidence > 0.7 ? "#22c55e" : s.ia_confidence > 0.4 ? "#f59e0b" : "#ef4444" }} />
                          </div>
                          <span>{(s.ia_confidence * 100).toFixed(0)}%</span>
                        </div>
                      ) : "—"}
                    </div>
                  </div>
                  {open && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", background: "var(--bg)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {s.resumen_ia && (
                        <div>
                          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Resumen (del PDF)</div>
                          <p style={{ fontSize: "0.83rem", color: "var(--ink2)", margin: 0, lineHeight: 1.5 }}>{s.resumen_ia}</p>
                        </div>
                      )}
                      {s.para_quien && (
                        <div>
                          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Para quién</div>
                          <p style={{ fontSize: "0.83rem", color: "var(--ink2)", margin: 0, lineHeight: 1.5 }}>{s.para_quien}</p>
                        </div>
                      )}
                      <div style={{ gridColumn: "span 2", display: "flex", gap: 10 }}>
                        {s.url_oficial && (
                          <a href={s.url_oficial} target="_blank" rel="noreferrer"
                            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "var(--blue)", textDecoration: "none" }}
                            onClick={e => e.stopPropagation()}>
                            <ExternalLink size={12} /> Ver convocatoria / PDF
                          </a>
                        )}
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Actualizado: {formatDate(s.updated_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} style={btnNav}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: "0.83rem", color: "var(--muted)" }}>Pág. {pagina} de {totalPaginas} · {total} resultados</span>
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} style={btnNav}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Panel Ajustes (drawer derecho) ── */}
      {panelAbierto && (
        <div style={{
          width: 370, flexShrink: 0, borderLeft: "1px solid var(--border)",
          background: "var(--surface)", display: "flex", flexDirection: "column",
          height: "calc(100vh - 60px)", position: "sticky", top: 0, overflow: "hidden",
        }}>
          {/* Header del panel */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 2 }}>
              {(["pipeline", "ia"] as const).map(tab => (
                <button key={tab} onClick={() => setTabPanel(tab)} style={{
                  padding: "6px 12px", borderRadius: 7, border: "none",
                  fontSize: "0.81rem", fontWeight: tabPanel === tab ? 700 : 500,
                  background: tabPanel === tab ? "var(--blue-bg)" : "transparent",
                  color: tabPanel === tab ? "var(--blue)" : "var(--muted)",
                  cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  {tab === "pipeline" ? <Zap size={13} /> : <Brain size={13} />}
                  {tab === "pipeline" ? "Pipeline" : "Proveedores IA"}
                </button>
              ))}
            </div>
            <button onClick={() => setPanelAbierto(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>

            {/* Tab Pipeline */}
            {tabPanel === "pipeline" && (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Banner estado IA */}
                <div style={{
                  padding: "9px 11px", borderRadius: 8,
                  background: proveedorActivo ? "#f0fdf4" : "#fffbeb",
                  border: `1px solid ${proveedorActivo ? "#bbf7d0" : "#fde68a"}`,
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} color={proveedorActivo ? "#22c55e" : "#d97706"} />
                  <div style={{ fontSize: "0.77rem" }}>
                    {proveedorActivo ? (
                      <span style={{ color: "#166534" }}>
                        IA activa: <strong>{proveedorActivo}</strong>. El pipeline leerá los PDFs y extraerá información estructurada de los documentos oficiales.
                      </span>
                    ) : (
                      <span style={{ color: "#92400e" }}>
                        Sin IA. Los PDFs se descargarán pero no se analizarán. La BD se rellena solo con datos básicos de BDNS.{" "}
                        <button onClick={() => setTabPanel("ia")} style={{ background: "none", border: "none", color: "#d97706", fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}>
                          Configurar IA →
                        </button>
                      </span>
                    )}
                  </div>
                </div>

                {/* Fases */}
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 7, letterSpacing: "0.06em" }}>
                    Fases del pipeline
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <PhaseRow icon={<Database size={13} />} num="1" label="Detectar en BDNS" sub="Índice de convocatorias y cambios" checked disabled />
                    <PhaseRow icon={<Download size={13} />} num="2" label="Descargar PDFs" sub="PDF oficial → Storage"
                      checked={config.descargar_pdfs} onChange={v => updateConfig({ descargar_pdfs: v })} />
                    <PhaseRow icon={<FileText size={13} />} num="3" label="Extraer texto del PDF" sub="Fuente de verdad para la IA"
                      checked={config.extraer_texto} disabled={!config.descargar_pdfs}
                      onChange={v => updateConfig({ extraer_texto: v })} />
                    <PhaseRow icon={<Brain size={13} />} num="4" label="Analizar con IA" sub="Extrae datos del documento oficial"
                      checked={config.analizar_con_ia} disabled={!proveedorActivo}
                      onChange={v => updateConfig({ analizar_con_ia: v })} />
                    <PhaseRow icon={<Database size={13} />} num="5" label="Guardar en base de datos" sub="BD siempre refleja los PDFs"
                      checked disabled />
                  </div>
                </div>

                {/* Params */}
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 7, letterSpacing: "0.06em" }}>
                    Parámetros
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                    <Param label="Convoc. por ingesta">
                      <input type="number" min={5} max={200} value={config.limite_diario}
                        onChange={e => updateConfig({ limite_diario: Number(e.target.value) })} style={inputSm} />
                    </Param>
                    <Param label="Días atrás a consultar">
                      <input type="number" min={1} max={30} value={config.dias_atras}
                        onChange={e => updateConfig({ dias_atras: Number(e.target.value) })} style={inputSm} />
                    </Param>
                    <Param label="Máx. páginas PDF">
                      <input type="number" min={5} max={200} value={config.max_paginas_pdf}
                        onChange={e => updateConfig({ max_paginas_pdf: Number(e.target.value) })} style={inputSm} />
                    </Param>
                    <Param label="Modelo IA (vacío=auto)">
                      <input type="text" value={config.modelo_ia} placeholder="auto"
                        onChange={e => updateConfig({ modelo_ia: e.target.value })} style={inputSm} />
                    </Param>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <button onClick={guardarConfig} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "8px 14px", borderRadius: 8, border: "none",
                    background: "var(--blue)", color: "#fff", fontSize: "0.82rem", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    {configGuardada ? <CheckCircle2 size={14} /> : <Save size={14} />}
                    {configGuardada ? "Guardado" : "Guardar configuración"}
                  </button>
                  <button onClick={() => { guardarConfig(); setPanelAbierto(false); lanzarIngesta(); }} disabled={ingestando} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "8px 14px", borderRadius: 8, border: "1px solid var(--blue)",
                    background: "var(--blue-bg)", color: "var(--blue)", fontSize: "0.82rem", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <Play size={14} /> Guardar y lanzar ingesta
                  </button>
                </div>
              </div>
            )}

            {/* Tab IA */}
            {tabPanel === "ia" && (
              <div>
                {userId
                  ? <AIConfigPanel userId={userId} workspaceType="expediente" inline isOpen />
                  : <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: "0.83rem" }}><Loader2 size={18} className="animate-spin" /><div style={{ marginTop: 8 }}>Cargando...</div></div>
                }
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function PhaseRow({ icon, num, label, sub, checked, disabled, onChange }: {
  icon: React.ReactNode; num: string; label: string; sub: string;
  checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void;
}) {
  return (
    <div onClick={() => !disabled && onChange?.(!checked)} style={{
      display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8,
      background: checked && !disabled ? "var(--blue-bg)" : "var(--bg)",
      border: `1px solid ${checked && !disabled ? "var(--blue)" : "var(--border)"}`,
      opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer",
    }}>
      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--muted)", width: 14, textAlign: "center" }}>{num}</span>
      <span style={{ color: checked && !disabled ? "var(--blue)" : "var(--muted)", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>{label}</div>
        <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{sub}</div>
      </div>
      <div style={{ width: 28, height: 15, borderRadius: 8, background: checked && !disabled ? "var(--blue)" : "var(--border)", position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 1.5, borderRadius: "50%", width: 12, height: 12, background: "#fff", left: checked && !disabled ? 14 : 1.5, transition: "left 0.15s" }} />
      </div>
    </div>
  );
}

function Param({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--ink2)", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputSt: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.83rem", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit" };
const inputSm: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)", fontSize: "0.81rem", background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" };
const selectSt: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.83rem", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit" };
const btnSec: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink2)", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
const btnNav: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center" };
