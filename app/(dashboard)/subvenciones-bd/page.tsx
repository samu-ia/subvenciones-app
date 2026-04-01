"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Database, RefreshCw, Play, CheckCircle2, Clock, AlertCircle,
  ExternalLink, Search, Loader2, Settings, Brain, FileText,
  ChevronRight, AlertTriangle, Shield, BarChart3, X, RotateCcw,
  Info, Zap, ChevronDown, ChevronUp, Eye, EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SubvencionItem {
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
  updated_at: string;
}

interface SubvencionDetalle extends SubvencionItem {
  objeto?: string;
  resumen_ia?: string;
  para_quien?: string;
  url_oficial?: string;
  plazo_inicio?: string;
  ambito_geografico?: string;
  comunidad_autonoma?: string;
  porcentaje_financiacion?: number;
  presupuesto_total?: number;
  pipeline_error?: string;
  ia_modelo?: string;
  // v1
  requisitos_list?: Array<{ id: string; descripcion: string; obligatorio: boolean; tipo?: string }>;
  gastos_list?: Array<{ id: string; descripcion: string; porcentaje_max?: number; categoria?: string }>;
  sectores_list?: Array<{ id: string; nombre_sector: string; cnae_codigo?: string; excluido: boolean }>;
  tipos_empresa_list?: Array<{ id: string; tipo: string; excluido: boolean }>;
  // v2
  documentos?: Array<{
    id: string; tipo_documento: string; titulo?: string; url_origen: string;
    estado: string; num_paginas?: number; tamanio_bytes?: number;
    es_principal: boolean; descargado_at?: string; error_msg?: string;
  }>;
  campos_extraidos?: Array<{
    id: string; nombre_campo: string; valor_texto?: string; valor_json?: unknown;
    fragmento_texto?: string; pagina_estimada?: number; metodo: string;
    modelo_ia?: string; confidence?: number; revisado: boolean;
  }>;
  eventos?: Array<{
    id: string; tipo_evento: string; fecha_evento?: string; titulo?: string;
    descripcion?: string; fuente: string; fragmento_texto?: string; confidence?: number;
  }>;
  estado_calculado?: {
    estado: string; razon?: string; dias_para_cierre?: number;
    urgente: boolean; calculado_at: string;
  } | null;
  conflictos?: Array<{
    id: string; tipo_conflicto: string; campo_afectado?: string;
    valor_a?: string; fuente_a?: string; valor_b?: string; fuente_b?: string;
    descripcion?: string; severidad: string; resuelto: boolean;
  }>;
  jobs_pendientes?: Array<{ id: string; tipo_job: string; estado: string }>;
  actualizaciones?: Array<{ id: string; tipo_cambio: string; detectada_at: string; resumen_cambio?: string }>;
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

// ─── Helpers visuales ────────────────────────────────────────────────────────

const ESTADOS: Record<string, { label: string; bg: string; color: string; dot?: string }> = {
  abierta:     { label: "Abierta",    bg: "#dcfce7", color: "#16a34a", dot: "#22c55e" },
  cerrada:     { label: "Cerrada",    bg: "#f1f5f9", color: "#64748b" },
  proxima:     { label: "Próxima",    bg: "#fef9c3", color: "#92400e", dot: "#f59e0b" },
  suspendida:  { label: "Suspendida", bg: "#fee2e2", color: "#dc2626" },
  resuelta:    { label: "Resuelta",   bg: "#f3e8ff", color: "#7c3aed" },
  desconocido: { label: "?",          bg: "#f1f5f9", color: "#94a3b8" },
};

const PIPELINE: Record<string, { label: string; color: string }> = {
  normalizado:    { label: "Completo",       color: "#22c55e" },
  ia_procesado:   { label: "IA procesado",   color: "#3b82f6" },
  texto_extraido: { label: "Texto extraído", color: "#8b5cf6" },
  pdf_descargado: { label: "PDF ok",         color: "#f59e0b" },
  raw:            { label: "Raw",            color: "#94a3b8" },
  error:          { label: "Error",          color: "#ef4444" },
};

const TIPO_EVENTO: Record<string, string> = {
  publicacion: "Publicación",
  apertura_plazo: "Apertura plazo",
  cierre_plazo: "Cierre plazo",
  correccion: "Corrección",
  ampliacion_plazo: "Ampliación plazo",
  suspension: "Suspensión",
  resolucion: "Resolución",
  pago: "Pago",
  otro: "Otro",
};

const TIPO_DOC: Record<string, { label: string; color: string }> = {
  extracto: { label: "Extracto", color: "#3b82f6" },
  convocatoria: { label: "Convocatoria", color: "#8b5cf6" },
  bases_reguladoras: { label: "Bases", color: "#f59e0b" },
  correccion: { label: "Corrección", color: "#ef4444" },
  ampliacion: { label: "Ampliación", color: "#22c55e" },
  resolucion: { label: "Resolución", color: "#6366f1" },
  otro: { label: "Otro", color: "#94a3b8" },
};

function fmt(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}
function fmtEuros(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n} €`;
}
function fmtMs(ms?: number) {
  if (!ms) return "";
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? ESTADOS.desconocido;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: e.bg, color: e.color,
      borderRadius: 20, padding: "2px 9px",
      fontSize: "0.72rem", fontWeight: 700,
    }}>
      {e.dot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: e.dot, display: "inline-block" }} />
      )}
      {e.label}
    </span>
  );
}

function PipelineBadge({ estado }: { estado: string }) {
  const p = PIPELINE[estado] ?? { label: estado, color: "#94a3b8" };
  return (
    <span style={{
      display: "inline-block",
      background: p.color + "22", color: p.color,
      borderRadius: 6, padding: "1px 7px",
      fontSize: "0.68rem", fontWeight: 700,
    }}>
      {p.label}
    </span>
  );
}

function ConfidenceBadge({ v }: { v?: number }) {
  if (v === undefined || v === null) return <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>—</span>;
  const pct = Math.round(v * 100);
  const color = pct >= 75 ? "#22c55e" : pct >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <span style={{ fontSize: "0.7rem", fontWeight: 700, color }}>{pct}%</span>
  );
}

// ─── Componente ficha detalle ─────────────────────────────────────────────────

type FichaTab = "ficha" | "docs" | "trazabilidad" | "timeline" | "conflictos";

function FichaPanel({
  sub,
  onClose,
  onReprocesar,
  reprocesando,
}: {
  sub: SubvencionDetalle;
  onClose: () => void;
  onReprocesar: (id: string, tipo: string) => void;
  reprocesando: boolean;
}) {
  const [tab, setTab] = useState<FichaTab>("ficha");
  const [expandedCampo, setExpandedCampo] = useState<string | null>(null);
  const [showReprocMenu, setShowReprocMenu] = useState(false);

  const ec = sub.estado_calculado;
  const tieneConflictos = (sub.conflictos?.filter(c => !c.resuelto) ?? []).length;
  const tieneJobs = (sub.jobs_pendientes ?? []).length > 0;

  const tabs: Array<{ key: FichaTab; label: string; badge?: number }> = [
    { key: "ficha", label: "Ficha" },
    { key: "docs", label: "Docs", badge: sub.documentos?.length },
    { key: "trazabilidad", label: "Trazabilidad", badge: sub.campos_extraidos?.length },
    { key: "timeline", label: "Timeline", badge: sub.eventos?.length },
    { key: "conflictos", label: "Conflictos", badge: tieneConflictos || undefined },
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#fff",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 0", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontFamily: "monospace" }}>
                BDNS #{sub.bdns_id}
              </span>
              <EstadoBadge estado={ec?.estado ?? sub.estado_convocatoria} />
              <PipelineBadge estado={sub.pipeline_estado} />
              {ec?.urgente && (
                <span style={{
                  background: "#fef2f2", color: "#dc2626", fontSize: "0.68rem",
                  fontWeight: 800, padding: "1px 7px", borderRadius: 6,
                }}>
                  URGENTE
                </span>
              )}
            </div>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.4, margin: 0 }}>
              {sub.titulo}
            </h2>
            {sub.organismo && (
              <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>{sub.organismo}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* Reprocesar */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowReprocMenu(!showReprocMenu)}
                disabled={reprocesando || tieneJobs}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: reprocesando || tieneJobs ? "#f1f5f9" : "#1a3561",
                  color: reprocesando || tieneJobs ? "#94a3b8" : "#fff",
                  border: "none", borderRadius: 8,
                  padding: "7px 12px", fontSize: "0.78rem", fontWeight: 600,
                  cursor: reprocesando || tieneJobs ? "not-allowed" : "pointer",
                }}
              >
                {reprocesando ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <RotateCcw size={13} />}
                {tieneJobs ? "En cola…" : "Reprocesar"}
                <ChevronDown size={12} />
              </button>
              {showReprocMenu && !tieneJobs && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, zIndex: 100,
                  background: "#fff", border: "1px solid #e2e8f0",
                  borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  minWidth: 200, marginTop: 4, overflow: "hidden",
                }}>
                  {[
                    { key: "reanalisis_completo", label: "Análisis completo" },
                    { key: "solo_ia", label: "Solo IA" },
                    { key: "solo_estado", label: "Solo estado" },
                    { key: "solo_documentos", label: "Solo documentos" },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { onReprocesar(sub.id, opt.key); setShowReprocMenu(false); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "10px 14px", background: "none", border: "none",
                        fontSize: "0.82rem", color: "#334155", cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {sub.url_oficial && (
              <a
                href={sub.url_oficial}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "#f1f5f9", color: "#64748b",
                  border: "none", borderRadius: 8,
                  padding: "7px 12px", fontSize: "0.78rem", fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={12} />
                Oficial
              </a>
            )}
            <button
              onClick={onClose}
              style={{
                background: "#f1f5f9", border: "none", borderRadius: 8,
                width: 32, height: 32, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#64748b",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Estado calculado razon */}
        {ec?.razon && (
          <div style={{
            background: ec.urgente ? "#fef2f2" : "#f0fdf4",
            border: `1px solid ${ec.urgente ? "#fecaca" : "#bbf7d0"}`,
            borderRadius: 8, padding: "7px 12px",
            fontSize: "0.76rem", color: ec.urgente ? "#991b1b" : "#166534",
            marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
          }}>
            <Info size={12} />
            {ec.razon}
            {ec.dias_para_cierre !== undefined && ec.dias_para_cierre >= 0 && (
              <strong style={{ marginLeft: 4 }}>({ec.dias_para_cierre} días)</strong>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: -1 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "8px 14px", fontSize: "0.8rem",
                color: tab === t.key ? "#1a3561" : "#94a3b8",
                fontWeight: tab === t.key ? 700 : 500,
                borderBottom: tab === t.key ? "2px solid #1a3561" : "2px solid transparent",
                display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
            >
              {t.label}
              {t.badge ? (
                <span style={{
                  background: t.key === "conflictos" ? "#fef2f2" : "#f1f5f9",
                  color: t.key === "conflictos" ? "#dc2626" : "#64748b",
                  borderRadius: 10, padding: "0 6px",
                  fontSize: "0.65rem", fontWeight: 700,
                }}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

        {/* ── FICHA ── */}
        {tab === "ficha" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Métricas rápidas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { label: "Importe máx.", value: fmtEuros(sub.importe_maximo) },
                { label: "Cofinanciación", value: sub.porcentaje_financiacion ? `${sub.porcentaje_financiacion}%` : "—" },
                { label: "Cierre", value: fmt(sub.plazo_fin) },
                { label: "Apertura", value: fmt(sub.plazo_inicio) },
                { label: "Publicación", value: fmt(sub.fecha_publicacion) },
                { label: "Confianza IA", value: sub.ia_confidence ? `${Math.round(sub.ia_confidence * 100)}%` : "—" },
              ].map(m => (
                <div key={m.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Resumen IA */}
            {sub.resumen_ia && (
              <Section label="Resumen IA" icon={<Brain size={14} />}>
                <p style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.65, margin: 0 }}>{sub.resumen_ia}</p>
              </Section>
            )}

            {/* Objeto */}
            {sub.objeto && (
              <Section label="Objeto">
                <p style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.65, margin: 0 }}>{sub.objeto}</p>
              </Section>
            )}

            {/* Para quién */}
            {sub.para_quien && (
              <Section label="Beneficiarios">
                <p style={{ fontSize: "0.82rem", color: "#334155", lineHeight: 1.65, margin: 0 }}>{sub.para_quien}</p>
              </Section>
            )}

            {/* Requisitos */}
            {(sub.requisitos_list ?? []).length > 0 && (
              <Section label="Requisitos">
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                  {sub.requisitos_list!.map(r => (
                    <li key={r.id} style={{ fontSize: "0.8rem", color: "#334155" }}>
                      {r.descripcion}
                      {!r.obligatorio && <span style={{ color: "#94a3b8", marginLeft: 6 }}>(opcional)</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Sectores + tipos empresa */}
            {(sub.sectores_list ?? []).length > 0 && (
              <Section label="Sectores">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {sub.sectores_list!.map(s => (
                    <span key={s.id} style={{
                      background: s.excluido ? "#fee2e2" : "#e0f2fe",
                      color: s.excluido ? "#dc2626" : "#0369a1",
                      borderRadius: 6, padding: "2px 8px", fontSize: "0.75rem",
                    }}>
                      {s.excluido ? "✗ " : ""}{s.nombre_sector}{s.cnae_codigo ? ` (${s.cnae_codigo})` : ""}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Pipeline info */}
            {sub.pipeline_error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
                  Error de pipeline
                </div>
                <p style={{ fontSize: "0.78rem", color: "#991b1b", margin: 0, fontFamily: "monospace" }}>
                  {sub.pipeline_error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── DOCS ── */}
        {tab === "docs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(sub.documentos ?? []).length === 0 ? (
              <Empty label="Sin documentos registrados" />
            ) : (
              sub.documentos!.map(doc => {
                const td = TIPO_DOC[doc.tipo_documento] ?? { label: doc.tipo_documento, color: "#94a3b8" };
                return (
                  <div key={doc.id} style={{
                    border: "1px solid #e2e8f0", borderRadius: 10,
                    padding: "14px 16px",
                    borderLeft: `3px solid ${td.color}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        background: td.color + "20", color: td.color,
                        borderRadius: 6, padding: "1px 8px", fontSize: "0.68rem", fontWeight: 700,
                      }}>
                        {td.label}
                      </span>
                      {doc.es_principal && (
                        <span style={{ fontSize: "0.68rem", color: "#f59e0b", fontWeight: 700 }}>PRINCIPAL</span>
                      )}
                      <span style={{
                        marginLeft: "auto", fontSize: "0.7rem",
                        color: doc.estado === "texto_extraido" ? "#22c55e" :
                               doc.estado === "error" || doc.estado === "no_disponible" ? "#ef4444" : "#f59e0b",
                        fontWeight: 700,
                      }}>
                        {doc.estado}
                      </span>
                    </div>
                    {doc.titulo && (
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>{doc.titulo}</div>
                    )}
                    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                      {doc.num_paginas && (
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{doc.num_paginas} páginas</span>
                      )}
                      {doc.tamanio_bytes && (
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          {(doc.tamanio_bytes / 1024).toFixed(0)} KB
                        </span>
                      )}
                      {doc.descargado_at && (
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          {fmt(doc.descargado_at)}
                        </span>
                      )}
                    </div>
                    {doc.error_msg && (
                      <div style={{ fontSize: "0.72rem", color: "#dc2626", marginTop: 4 }}>{doc.error_msg}</div>
                    )}
                    <a
                      href={doc.url_origen}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.72rem", color: "#3b82f6", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6 }}
                    >
                      <ExternalLink size={10} />
                      {doc.url_origen.length > 60 ? doc.url_origen.slice(0, 60) + "…" : doc.url_origen}
                    </a>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TRAZABILIDAD ── */}
        {tab === "trazabilidad" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(sub.campos_extraidos ?? []).length === 0 ? (
              <Empty label="Sin campos extraídos con grounding. Reprocesa con IA para generar trazabilidad." />
            ) : (
              sub.campos_extraidos!.map(campo => {
                const expanded = expandedCampo === campo.id;
                return (
                  <div key={campo.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8 }}>
                    <button
                      onClick={() => setExpandedCampo(expanded ? null : campo.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "10px 14px",
                        background: "none", border: "none", cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", minWidth: 160 }}>
                        {campo.nombre_campo}
                      </span>
                      <span style={{
                        flex: 1, fontSize: "0.8rem", color: "#0f172a",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {campo.valor_texto ?? JSON.stringify(campo.valor_json)?.slice(0, 80) ?? "—"}
                      </span>
                      <ConfidenceBadge v={campo.confidence} />
                      <span style={{
                        fontSize: "0.65rem", color: "#94a3b8",
                        background: "#f1f5f9", borderRadius: 4, padding: "1px 6px",
                      }}>
                        {campo.metodo}
                      </span>
                      {expanded ? <ChevronUp size={13} color="#94a3b8" /> : <ChevronDown size={13} color="#94a3b8" />}
                    </button>
                    {expanded && (
                      <div style={{ padding: "0 14px 12px", borderTop: "1px solid #f1f5f9" }}>
                        {campo.fragmento_texto && (
                          <blockquote style={{
                            margin: "10px 0 0",
                            borderLeft: "3px solid #3b82f6",
                            paddingLeft: 12,
                            fontSize: "0.78rem", color: "#334155",
                            fontStyle: "italic", lineHeight: 1.55,
                          }}>
                            &ldquo;{campo.fragmento_texto}&rdquo;
                            {campo.pagina_estimada && (
                              <span style={{ color: "#94a3b8", fontStyle: "normal", marginLeft: 8, fontSize: "0.72rem" }}>
                                (p. {campo.pagina_estimada})
                              </span>
                            )}
                          </blockquote>
                        )}
                        {campo.modelo_ia && (
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 6 }}>
                            Modelo: {campo.modelo_ia}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TIMELINE ── */}
        {tab === "timeline" && (
          <div style={{ position: "relative" }}>
            {(sub.eventos ?? []).length === 0 ? (
              <Empty label="Sin eventos detectados en documentos." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {sub.eventos!.map((ev, i) => (
                  <div key={ev.id} style={{ display: "flex", gap: 12 }}>
                    {/* Line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: "#1a3561", border: "2px solid #e2e8f0",
                        flexShrink: 0, marginTop: 4,
                      }} />
                      {i < sub.eventos!.length - 1 && (
                        <div style={{ width: 1, background: "#e2e8f0", flex: 1, minHeight: 20 }} />
                      )}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>
                          {TIPO_EVENTO[ev.tipo_evento] ?? ev.tipo_evento}
                        </span>
                        {ev.fecha_evento && (
                          <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{fmt(ev.fecha_evento)}</span>
                        )}
                        <span style={{
                          fontSize: "0.65rem", color: "#94a3b8",
                          background: "#f1f5f9", borderRadius: 4, padding: "1px 5px",
                        }}>
                          {ev.fuente}
                        </span>
                        {ev.confidence !== undefined && <ConfidenceBadge v={ev.confidence} />}
                      </div>
                      {ev.descripcion && (
                        <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "4px 0 0", lineHeight: 1.5 }}>
                          {ev.descripcion}
                        </p>
                      )}
                      {ev.fragmento_texto && (
                        <blockquote style={{
                          margin: "6px 0 0", borderLeft: "2px solid #e2e8f0",
                          paddingLeft: 10, fontSize: "0.75rem", color: "#64748b",
                          fontStyle: "italic",
                        }}>
                          &ldquo;{ev.fragmento_texto}&rdquo;
                        </blockquote>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CONFLICTOS ── */}
        {tab === "conflictos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(sub.conflictos ?? []).length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 20px",
                color: "#22c55e", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}>
                <Shield size={32} />
                <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Sin conflictos detectados</div>
              </div>
            ) : (
              sub.conflictos!.map(c => (
                <div key={c.id} style={{
                  border: `1px solid ${c.severidad === "alta" ? "#fecaca" : c.severidad === "media" ? "#fde68a" : "#e2e8f0"}`,
                  background: c.resuelto ? "#f0fdf4" : "#fff",
                  borderRadius: 10, padding: "14px 16px",
                  borderLeft: `3px solid ${c.severidad === "alta" ? "#ef4444" : c.severidad === "media" ? "#f59e0b" : "#94a3b8"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <AlertTriangle size={13} color={c.severidad === "alta" ? "#ef4444" : "#f59e0b"} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>
                      {c.campo_afectado ?? c.tipo_conflicto}
                    </span>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700,
                      color: c.severidad === "alta" ? "#dc2626" : c.severidad === "media" ? "#92400e" : "#64748b",
                      background: c.severidad === "alta" ? "#fee2e2" : c.severidad === "media" ? "#fef3c7" : "#f1f5f9",
                      borderRadius: 4, padding: "1px 6px",
                    }}>
                      {c.severidad}
                    </span>
                    {c.resuelto && (
                      <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "#22c55e", fontWeight: 700 }}>
                        ✓ RESUELTO
                      </span>
                    )}
                  </div>
                  {c.descripcion && (
                    <p style={{ fontSize: "0.8rem", color: "#334155", margin: "0 0 8px", lineHeight: 1.5 }}>
                      {c.descripcion}
                    </p>
                  )}
                  {c.valor_a && c.valor_b && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1, background: "#f8fafc", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, marginBottom: 2 }}>
                          {c.fuente_a ?? "Fuente A"}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 600 }}>{c.valor_a}</div>
                      </div>
                      <div style={{ flex: 1, background: "#f8fafc", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, marginBottom: 2 }}>
                          {c.fuente_b ?? "Fuente B"}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 600 }}>{c.valor_b}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Section({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: "#94a3b8" }}>{icon}</span>}
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
      <div style={{ fontSize: "0.82rem" }}>{label}</div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SubvencionsBdPage() {
  const supabase = createClient();

  // Lista
  const [items, setItems] = useState<SubvencionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPipeline, setFiltroPipeline] = useState("");

  // Detalle
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<SubvencionDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [reprocesando, setReprocesando] = useState(false);

  // Ingesta
  const [ingestando, setIngestando] = useState(false);
  const [feedbackIngesta, setFeedbackIngesta] = useState<string | null>(null);
  const [logs, setLogs] = useState<IngestaLog[]>([]);

  // Config
  const [panelIA, setPanelIA] = useState(false);
  const [proveedorActivo, setProveedorActivo] = useState<string | null>(null);

  // Estado panel IA providers
  const [iaProviders, setIaProviders] = useState<Array<{id:string;provider:string;api_key:string|null;base_url:string|null;enabled:boolean}>>([]);
  const [iaKeys, setIaKeys] = useState<Record<string,string>>({});
  const [iaShowKey, setIaShowKey] = useState<Record<string,boolean>>({});
  const [iaSaving, setIaSaving] = useState<Record<string,boolean>>({});
  const [iaTesting, setIaTesting] = useState<Record<string,boolean>>({});
  const [iaTestResult, setIaTestResult] = useState<Record<string,string>>({});
  const [iaMsg, setIaMsg] = useState('');

  const PROVIDER_LABEL: Record<string,string> = { openai:'OpenAI', anthropic:'Anthropic', google:'Google Gemini', openrouter:'OpenRouter' };
  const CHEAP_MODEL: Record<string,string> = { openai:'gpt-4o-mini', anthropic:'claude-3-haiku', google:'gemini-2.5-flash', openrouter:'openai/gpt-4o-mini' };

  const cargarIaProviders = useCallback(async () => {
    const r = await fetch('/api/admin/ia-providers');
    if (!r.ok) return;
    const data = await r.json();
    setIaProviders(data);
    const keys: Record<string,string> = {};
    data.forEach((p: {id:string;api_key:string|null}) => { keys[p.id] = p.api_key ?? ''; });
    setIaKeys(keys);
    const activo = data.find((p: {enabled:boolean;api_key:string|null}) => p.enabled && p.api_key);
    setProveedorActivo(activo?.provider ?? null);
  }, []);

  const tamanio = 25;

  useEffect(() => {
    cargarIaProviders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarLista = useCallback(async () => {
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
      setItems(data.data ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  }, [pagina, busqueda, filtroEstado, filtroPipeline]);

  useEffect(() => { cargarLista(); }, [cargarLista]);

  const cargarLogs = useCallback(async () => {
    const res = await fetch("/api/subvenciones/ingesta-log?limit=5");
    const data = await res.json();
    setLogs(data.logs ?? []);
  }, []);

  useEffect(() => { cargarLogs(); }, [cargarLogs]);

  async function cargarDetalle(id: string) {
    setSelectedId(id);
    setLoadingDetalle(true);
    setDetalle(null);
    try {
      const res = await fetch(`/api/subvenciones/catalogo/${id}`);
      const data = await res.json();
      setDetalle(data);
    } finally { setLoadingDetalle(false); }
  }

  async function handleReprocesar(id: string, tipoJob: string) {
    setReprocesando(true);
    try {
      const res = await fetch(`/api/subvenciones/catalogo/${id}/reprocesar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_job: tipoJob, motivo: "Solicitud manual desde panel admin", inmediato: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedbackIngesta(`Reprocesando con Gemini PDF… Los datos se actualizarán en unos segundos.`);
        setTimeout(() => cargarDetalle(id), 5000);
      } else {
        setFeedbackIngesta(data.message ?? data.error ?? "Error al crear job");
      }
    } finally { setReprocesando(false); }
  }

  async function lanzarIngesta() {
    setIngestando(true);
    setFeedbackIngesta(null);
    try {
      const res = await fetch("/api/subvenciones/ingest", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setFeedbackIngesta(`✓ ${data.mensaje}`);
        await cargarLista();
        await cargarLogs();
      } else {
        setFeedbackIngesta(`Error: ${data.error ?? "desconocido"}`);
      }
    } finally { setIngestando(false); }
  }

  const totalPaginas = Math.ceil(total / tamanio);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
      {/* Top bar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "14px 24px", display: "flex", alignItems: "center", gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Database size={18} color="#1a3561" />
          <span style={{ fontWeight: 800, fontSize: "1rem", color: "#1a3561" }}>Subvenciones BDNS</span>
          <span style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 10, padding: "1px 9px", fontSize: "0.75rem", fontWeight: 600 }}>
            {total.toLocaleString()} registros
          </span>
        </div>

        {/* Proveedor IA */}
        {proveedorActivo ? (
          <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
            <Zap size={11} /> {proveedorActivo}
          </span>
        ) : (
          <span style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 8, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
            Sin IA
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => { setPanelIA(true); }}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "#f1f5f9", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "#334155" }}
          >
            <Brain size={14} /> Config IA
          </button>
          <button
            onClick={cargarLista}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "#f1f5f9", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "#334155" }}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={lanzarIngesta}
            disabled={ingestando}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: ingestando ? "#f1f5f9" : "#1a3561",
              color: ingestando ? "#94a3b8" : "#fff",
              border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700,
              cursor: ingestando ? "not-allowed" : "pointer",
            }}
          >
            {ingestando ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={14} />}
            {ingestando ? "Ingestando…" : "Iniciar ingesta"}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedbackIngesta && (
        <div style={{
          background: feedbackIngesta.startsWith("Error") ? "#fef2f2" : "#f0fdf4",
          borderBottom: `1px solid ${feedbackIngesta.startsWith("Error") ? "#fecaca" : "#bbf7d0"}`,
          padding: "10px 24px", fontSize: "0.8rem",
          color: feedbackIngesta.startsWith("Error") ? "#dc2626" : "#166534",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {feedbackIngesta}
          <button onClick={() => setFeedbackIngesta(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Content: list + detail */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* LEFT: Lista */}
        <div style={{
          width: selectedId ? 380 : "100%",
          flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderRight: selectedId ? "1px solid #e2e8f0" : "none",
          overflow: "hidden",
          transition: "width 0.2s",
        }}>
          {/* Filtros */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", background: "#fff", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 140 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
                placeholder="Buscar…"
                style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.8rem", outline: "none", boxSizing: "border-box", color: "#334155" }}
              />
            </div>
            <select
              value={filtroEstado}
              onChange={e => { setFiltroEstado(e.target.value); setPagina(1); }}
              style={{ padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.78rem", color: "#334155", outline: "none", background: "#fff" }}
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={filtroPipeline}
              onChange={e => { setFiltroPipeline(e.target.value); setPagina(1); }}
              style={{ padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.78rem", color: "#334155", outline: "none", background: "#fff" }}
            >
              <option value="">Pipeline</option>
              {Object.entries(PIPELINE).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Lista items */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "#94a3b8" }} />
              </div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: "0.85rem" }}>
                Sin resultados
              </div>
            ) : (
              items.map(item => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => cargarDetalle(item.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "12px 16px", background: isSelected ? "#f0f6ff" : "#fff",
                      border: "none", borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      borderLeft: isSelected ? "3px solid #1a3561" : "3px solid transparent",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "#fff"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <EstadoBadge estado={item.estado_convocatoria} />
                      <PipelineBadge estado={item.pipeline_estado} />
                      <ChevronRight size={12} color="#94a3b8" style={{ marginLeft: "auto" }} />
                    </div>
                    <div style={{
                      fontSize: "0.82rem", fontWeight: 600, color: "#0f172a",
                      lineHeight: 1.35,
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {item.titulo}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                      {item.organismo && (
                        <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                          {item.organismo.length > 35 ? item.organismo.slice(0, 35) + "…" : item.organismo}
                        </span>
                      )}
                      {item.importe_maximo && (
                        <span style={{ fontSize: "0.7rem", color: "#0369a1", fontWeight: 700, marginLeft: "auto", flexShrink: 0 }}>
                          {fmtEuros(item.importe_maximo)}
                        </span>
                      )}
                    </div>
                    {item.plazo_fin && (
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 3 }}>
                        Cierre: {fmt(item.plazo_fin)}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Paginación + logs */}
          <div style={{ borderTop: "1px solid #e2e8f0", background: "#fff" }}>
            {/* Paginación */}
            {totalPaginas > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #f1f5f9" }}>
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", fontSize: "0.75rem", cursor: pagina === 1 ? "not-allowed" : "pointer", color: "#64748b" }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {pagina} / {totalPaginas}
                </span>
                <button
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", fontSize: "0.75rem", cursor: pagina === totalPaginas ? "not-allowed" : "pointer", color: "#64748b" }}
                >
                  Siguiente
                </button>
              </div>
            )}

            {/* Últimas ingestas */}
            {logs.length > 0 && (
              <div style={{ padding: "10px 16px" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                  ÚLTIMAS INGESTAS
                </div>
                {logs.slice(0, 3).map(log => (
                  <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {log.estado === "completado" ? (
                      <CheckCircle2 size={11} color="#22c55e" />
                    ) : log.estado === "error" ? (
                      <AlertCircle size={11} color="#ef4444" />
                    ) : (
                      <Clock size={11} color="#f59e0b" />
                    )}
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                      {fmt(log.fecha_ingesta)} — {log.nuevas}N {log.actualizadas}A {log.errores > 0 ? `${log.errores}E` : ""}
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "#94a3b8", marginLeft: "auto" }}>
                      {fmtMs(log.duracion_ms)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Detalle */}
        {selectedId && (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {loadingDetalle ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#94a3b8" }} />
              </div>
            ) : detalle ? (
              <FichaPanel
                sub={detalle}
                onClose={() => { setSelectedId(null); setDetalle(null); }}
                onReprocesar={handleReprocesar}
                reprocesando={reprocesando}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#94a3b8", fontSize: "0.85rem" }}>
                Error cargando detalle
              </div>
            )}
          </div>
        )}

        {/* Empty state when nothing selected */}
        {!selectedId && !loading && items.length > 0 && (
          <div style={{ display: "none" }} /> /* lista ocupa full width */
        )}
      </div>

      {/* Panel configuración IA providers (pipeline) */}
      {panelIA && (
        <div
          onClick={() => { setPanelIA(false); setIaMsg(''); }}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "var(--bg)", borderRadius: "16px 0 0 0", width: 440, maxHeight: "90vh", overflow: "auto", padding: 24, boxShadow: "-4px 0 24px rgba(0,0,0,0.15)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--ink)" }}>Proveedores IA</span>
              <button onClick={() => setPanelIA(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 18 }}>
              Configura la API key del proveedor que usará el pipeline de ingestión BDNS.
            </p>

            {iaProviders.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Cargando...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {iaProviders.map(p => (
                  <div key={p.id} style={{
                    border: `1.5px solid ${p.enabled ? "var(--blue)" : "var(--border)"}`,
                    borderRadius: 12, padding: "14px 16px",
                    background: "var(--surface)", opacity: p.enabled ? 1 : 0.75,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)" }}>{PROVIDER_LABEL[p.provider] ?? p.provider}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Modelo pipeline: <code>{CHEAP_MODEL[p.provider] ?? '—'}</code></div>
                      </div>
                      <div
                        onClick={() => setIaProviders(prev => prev.map(x => x.id === p.id ? {...x, enabled: !x.enabled} : x))}
                        style={{ width: 36, height: 20, borderRadius: 20, background: p.enabled ? "var(--blue)" : "var(--border)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
                      >
                        <div style={{ position: "absolute", top: 2, left: p.enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <div style={{ flex: 1, position: "relative" }}>
                        <input
                          type={iaShowKey[p.id] ? "text" : "password"}
                          value={iaKeys[p.id] ?? ''}
                          onChange={e => setIaKeys(prev => ({...prev, [p.id]: e.target.value}))}
                          placeholder="API Key..."
                          style={{ width: "100%", padding: "7px 32px 7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.82rem", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box", fontFamily: "monospace" }}
                        />
                        <button onClick={() => setIaShowKey(prev => ({...prev, [p.id]: !prev[p.id]}))} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0 }}>
                          {iaShowKey[p.id] ? <EyeOff size={13}/> : <Eye size={13}/>}
                        </button>
                      </div>
                      <button
                        onClick={async () => {
                          setIaSaving(prev => ({...prev, [p.id]: true})); setIaMsg('');
                          const r = await fetch(`/api/admin/ia-providers/${p.id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ api_key: iaKeys[p.id] || null, enabled: p.enabled }) });
                          setIaSaving(prev => ({...prev, [p.id]: false}));
                          if (r.ok) { setIaMsg('Guardado'); cargarIaProviders(); }
                          else { const d = await r.json(); setIaMsg(`Error: ${d.error}`); }
                        }}
                        disabled={iaSaving[p.id]}
                        style={{ padding: "7px 14px", borderRadius: 8, background: "var(--blue)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap" }}
                      >
                        {iaSaving[p.id] ? "..." : "Guardar"}
                      </button>
                    </div>

                    <button
                      onClick={async () => {
                        setIaTesting(prev => ({...prev, [p.id]: true})); setIaTestResult(prev => ({...prev, [p.id]: ''}));
                        const r = await fetch(`/api/admin/ia-providers/${p.id}/test`, { method: 'POST' });
                        const d = await r.json();
                        setIaTesting(prev => ({...prev, [p.id]: false}));
                        setIaTestResult(prev => ({...prev, [p.id]: r.ok ? 'ok' : d.error ?? 'error'}));
                      }}
                      disabled={iaTesting[p.id] || !iaKeys[p.id]}
                      style={{ padding: "5px 12px", borderRadius: 7, background: "transparent", color: "var(--ink2)", border: "1px solid var(--border)", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit" }}
                    >
                      {iaTesting[p.id] ? "Probando..." : "Probar conexión"}
                    </button>

                    {iaTestResult[p.id] && (
                      <div style={{ marginTop: 6, fontSize: "0.78rem", color: iaTestResult[p.id] === 'ok' ? '#16a34a' : '#dc2626', display: "flex", alignItems: "center", gap: 4 }}>
                        {iaTestResult[p.id] === 'ok' ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>}
                        {iaTestResult[p.id] === 'ok' ? 'Conexión correcta' : iaTestResult[p.id]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {iaMsg && (
              <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: iaMsg.startsWith('Error') ? '#fee2e2' : '#dcfce7', color: iaMsg.startsWith('Error') ? '#dc2626' : '#16a34a', fontSize: "0.82rem" }}>
                {iaMsg}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
