"use client";

/**
 * app/(dashboard)/subvenciones-bd/page.tsx
 *
 * Catálogo de subvenciones ingestadas desde BDNS.
 * Muestra estado del pipeline, filtros y permite lanzar ingesta manualmente.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Database, RefreshCw, Play, CheckCircle2, Clock, AlertCircle,
  ExternalLink, ChevronLeft, ChevronRight, Search, Filter, Loader2,
} from "lucide-react";

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
  ambito_geografico?: string;
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
  iniciado_at: string;
}

const ESTADOS_CONV: Record<string, { label: string; color: string }> = {
  abierta:    { label: "Abierta",    color: "#22c55e" },
  cerrada:    { label: "Cerrada",    color: "#94a3b8" },
  proxima:    { label: "Próxima",    color: "#f59e0b" },
  suspendida: { label: "Suspendida", color: "#ef4444" },
  resuelta:   { label: "Resuelta",   color: "#8b5cf6" },
  desconocido: { label: "?",         color: "#94a3b8" },
};

const PIPELINE_ESTADOS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  normalizado:     { label: "✓ Completo",    color: "#22c55e", icon: <CheckCircle2 size={12} /> },
  ia_procesado:    { label: "IA procesado",  color: "#3b82f6", icon: <CheckCircle2 size={12} /> },
  texto_extraido:  { label: "Texto extraído",color: "#8b5cf6", icon: <Clock size={12} /> },
  pdf_descargado:  { label: "PDF ok",        color: "#f59e0b", icon: <Clock size={12} /> },
  raw:             { label: "Raw",           color: "#94a3b8", icon: <Clock size={12} /> },
  error:           { label: "Error",         color: "#ef4444", icon: <AlertCircle size={12} /> },
};

function formatEuros(n?: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n} €`;
}

function formatDate(s?: string): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}

function formatDuracion(ms?: number): string {
  if (!ms) return "";
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
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
  const tamanio = 20;

  const cargarSubvenciones = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        tamanio: String(tamanio),
        ...(busqueda && { q: busqueda }),
        ...(filtroEstado && { estado: filtroEstado }),
        ...(filtroPipeline && { pipeline: filtroPipeline }),
      });
      const res = await fetch(`/api/subvenciones/catalogo?${params}`);
      const data = await res.json();
      setSubvenciones(data.data ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
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
    setFeedbackIngesta("Lanzando pipeline de ingestión BDNS...");
    try {
      const res = await fetch("/api/subvenciones/ingest", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setFeedbackIngesta(
          `✅ ${data.resultado?.nuevas ?? 0} nuevas · ${data.resultado?.actualizadas ?? 0} actualizadas · ${data.resultado?.errores ?? 0} errores`
        );
        await cargarSubvenciones();
        await cargarLogs();
      } else {
        setFeedbackIngesta(`❌ Error: ${data.error}`);
      }
    } catch (e) {
      setFeedbackIngesta(`❌ Error de red`);
    } finally {
      setIngestando(false);
      setTimeout(() => setFeedbackIngesta(null), 8000);
    }
  };

  const totalPaginas = Math.ceil(total / tamanio);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200 }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Database size={22} color="var(--blue)" />
          <div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              Catálogo BDNS
            </h1>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "2px 0 0" }}>
              {total.toLocaleString()} subvenciones · actualizado desde BDNS oficial
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={cargarSubvenciones}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--ink2)", fontSize: "0.82rem",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>

          <button
            onClick={lanzarIngesta}
            disabled={ingestando}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 8, border: "none",
              background: ingestando ? "var(--blue-bg)" : "var(--blue)",
              color: ingestando ? "var(--blue)" : "#fff", fontSize: "0.82rem",
              cursor: ingestando ? "not-allowed" : "pointer", fontWeight: 600, fontFamily: "inherit",
            }}
          >
            {ingestando ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {ingestando ? "Ingestando..." : "Lanzar ingesta"}
          </button>
        </div>
      </div>

      {/* ── Feedback ingesta ────────────────────────────────────────── */}
      {feedbackIngesta && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, marginBottom: 16,
          background: feedbackIngesta.startsWith("✅") ? "#f0fdf4" : feedbackIngesta.startsWith("❌") ? "#fef2f2" : "#eff6ff",
          border: `1px solid ${feedbackIngesta.startsWith("✅") ? "#bbf7d0" : feedbackIngesta.startsWith("❌") ? "#fecaca" : "#bfdbfe"}`,
          fontSize: "0.83rem", color: "var(--ink2)",
        }}>
          {feedbackIngesta}
        </div>
      )}

      {/* ── Último log ──────────────────────────────────────────────── */}
      {logs.length > 0 && (
        <div style={{
          display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap",
        }}>
          {logs.slice(0, 3).map(log => (
            <div key={log.id} style={{
              padding: "8px 14px", borderRadius: 8,
              background: "var(--surface)", border: "1px solid var(--border)",
              fontSize: "0.78rem", color: "var(--ink2)", display: "flex", gap: 8, alignItems: "center",
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

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            placeholder="Buscar por título, organismo..."
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
            style={{
              width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8,
              border: "1px solid var(--border)", fontSize: "0.83rem",
              background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        <select
          value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); setPagina(1); }}
          style={{
            padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
            fontSize: "0.83rem", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit",
          }}
        >
          <option value="">Todos los estados</option>
          <option value="abierta">Abierta</option>
          <option value="proxima">Próxima</option>
          <option value="cerrada">Cerrada</option>
          <option value="resuelta">Resuelta</option>
        </select>

        <select
          value={filtroPipeline}
          onChange={e => { setFiltroPipeline(e.target.value); setPagina(1); }}
          style={{
            padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
            fontSize: "0.83rem", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit",
          }}
        >
          <option value="">Todo el pipeline</option>
          <option value="normalizado">Normalizado ✓</option>
          <option value="error">Con errores</option>
          <option value="raw">Solo raw</option>
        </select>
      </div>

      {/* ── Tabla ───────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: "var(--muted)" }}>
          <Loader2 size={20} className="animate-spin" style={{ marginRight: 10 }} /> Cargando...
        </div>
      ) : subvenciones.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "var(--surface)", borderRadius: 12, border: "1px dashed var(--border)",
          color: "var(--muted)",
        }}>
          <Database size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontWeight: 600, margin: "0 0 6px" }}>Sin subvenciones</p>
          <p style={{ fontSize: "0.83rem", margin: 0 }}>
            {busqueda || filtroEstado ? "No hay resultados para los filtros aplicados." : "Lanza la primera ingesta para poblar el catálogo."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subvenciones.map(s => {
            const estadoConv = ESTADOS_CONV[s.estado_convocatoria] ?? ESTADOS_CONV.desconocido;
            const estadoPipe = PIPELINE_ESTADOS[s.pipeline_estado] ?? PIPELINE_ESTADOS.raw;
            const isExpanded = expandida === s.id;

            return (
              <div
                key={s.id}
                style={{
                  background: "var(--surface)", borderRadius: 10,
                  border: `1px solid ${isExpanded ? "var(--blue)" : "var(--border)"}`,
                  overflow: "hidden", transition: "border-color 0.15s",
                }}
              >
                {/* Fila principal */}
                <div
                  onClick={() => setExpandida(isExpanded ? null : s.id)}
                  style={{
                    padding: "12px 16px", cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "1fr 160px 90px 80px 90px",
                    gap: 12, alignItems: "center",
                  }}
                >
                  {/* Título + organismo */}
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, marginBottom: 2 }}>
                      {s.titulo}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {s.organismo ?? "—"} · BDNS {s.bdns_id}
                    </div>
                  </div>

                  {/* Estado convocatoria + pipeline */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                      background: estadoConv.color + "20", color: estadoConv.color,
                    }}>{estadoConv.label}</span>
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 500, padding: "2px 8px", borderRadius: 20,
                      background: estadoPipe.color + "18", color: estadoPipe.color,
                      display: "flex", alignItems: "center", gap: 3,
                    }}>
                      {estadoPipe.icon} {estadoPipe.label}
                    </span>
                  </div>

                  {/* Importe */}
                  <div style={{ textAlign: "right", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink)" }}>
                    {formatEuros(s.importe_maximo)}
                    {s.porcentaje_financiacion && (
                      <div style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--muted)" }}>
                        {s.porcentaje_financiacion}%
                      </div>
                    )}
                  </div>

                  {/* Plazo fin */}
                  <div style={{ textAlign: "right", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {s.plazo_fin ? (
                      <>
                        <div style={{ fontWeight: 600, color: "var(--ink2)" }}>Hasta</div>
                        {formatDate(s.plazo_fin)}
                      </>
                    ) : "—"}
                  </div>

                  {/* Confianza IA */}
                  <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--muted)" }}>
                    {s.ia_confidence != null ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <div style={{
                          width: 40, height: 4, borderRadius: 2,
                          background: "var(--border)", overflow: "hidden",
                        }}>
                          <div style={{
                            width: `${(s.ia_confidence * 100).toFixed(0)}%`, height: "100%",
                            background: s.ia_confidence > 0.7 ? "#22c55e" : s.ia_confidence > 0.4 ? "#f59e0b" : "#ef4444",
                          }} />
                        </div>
                        <span>{(s.ia_confidence * 100).toFixed(0)}%</span>
                      </div>
                    ) : "—"}
                  </div>
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div style={{
                    borderTop: "1px solid var(--border)",
                    padding: "14px 16px",
                    background: "var(--bg)",
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
                  }}>
                    {s.resumen_ia && (
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                          Resumen IA
                        </div>
                        <p style={{ fontSize: "0.83rem", color: "var(--ink2)", margin: 0, lineHeight: 1.5 }}>
                          {s.resumen_ia}
                        </p>
                      </div>
                    )}
                    {s.para_quien && (
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                          Para quién
                        </div>
                        <p style={{ fontSize: "0.83rem", color: "var(--ink2)", margin: 0, lineHeight: 1.5 }}>
                          {s.para_quien}
                        </p>
                      </div>
                    )}
                    <div style={{ gridColumn: "span 2", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {s.url_oficial && (
                        <a href={s.url_oficial} target="_blank" rel="noreferrer"
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            fontSize: "0.78rem", color: "var(--blue)", textDecoration: "none",
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={12} /> Ver convocatoria
                        </a>
                      )}
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Actualizado: {formatDate(s.updated_at)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Paginación ──────────────────────────────────────────────── */}
      {totalPaginas > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
          <button
            onClick={() => setPagina(p => Math.max(1, p - 1))}
            disabled={pagina === 1}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: "0.83rem", color: "var(--muted)" }}>
            Pág. {pagina} de {totalPaginas} · {total} resultados
          </span>
          <button
            onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            disabled={pagina === totalPaginas}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
