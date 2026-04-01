"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search, ExternalLink, Calendar, Building2, Euro, ChevronDown,
  RefreshCw, Filter, X, TrendingUp,
} from "lucide-react";

interface Subvencion {
  id: string;
  bdns_id: string;
  titulo: string;
  organismo?: string;
  departamento?: string;
  ambito_geografico?: string;
  comunidad_autonoma?: string;
  objeto?: string;
  resumen_ia?: string;
  para_quien?: string;
  fecha_publicacion?: string;
  plazo_inicio?: string;
  plazo_fin?: string;
  importe_maximo?: number;
  importe_minimo?: number;
  presupuesto_total?: number;
  porcentaje_financiacion?: number;
  estado_convocatoria: string;
  pipeline_estado: string;
  ia_confidence?: number;
  url_oficial?: string;
}

const ESTADO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  abierta:     { label: "Abierta",     color: "#16a34a", bg: "#dcfce7" },
  resuelta:    { label: "Resuelta",    color: "#9333ea", bg: "#f3e8ff" },
  desconocido: { label: "Sin estado",  color: "#6b7280", bg: "#f3f4f6" },
  cerrada:     { label: "Cerrada",     color: "#dc2626", bg: "#fee2e2" },
};

const CCAAS = [
  "Andalucía", "Aragón", "Asturias", "Illes Balears", "Canarias", "Cantabria",
  "Castilla-La Mancha", "Castilla y León", "Cataluña", "Ceuta",
  "Comunidad Valenciana", "Extremadura", "Galicia", "Madrid",
  "Melilla", "Murcia", "Navarra", "País Vasco", "La Rioja",
];

function fmt(n?: number | null) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n.toLocaleString("es-ES")} €`;
}

function fmtDate(s?: string) {
  if (!s) return null;
  return new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function diasRestantes(plazoFin?: string) {
  if (!plazoFin) return null;
  const diff = Math.ceil((new Date(plazoFin).getTime() - Date.now()) / 86_400_000);
  return diff;
}

export default function SubvencionesPage() {
  const [subvenciones, setSubvenciones] = useState<Subvencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Filtros
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [estado, setEstado] = useState("");
  const [ccaa, setCcaa] = useState("");
  const [soloAbiertas, setSoloAbiertas] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);

  // Modal detalle
  const [selected, setSelected] = useState<Subvencion | null>(null);

  const PAGE_SIZE = 20;

  const cargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from("subvenciones")
      .select("id,bdns_id,titulo,organismo,departamento,ambito_geografico,comunidad_autonoma,objeto,resumen_ia,para_quien,fecha_publicacion,plazo_inicio,plazo_fin,importe_maximo,importe_minimo,presupuesto_total,porcentaje_financiacion,estado_convocatoria,pipeline_estado,ia_confidence,url_oficial", { count: "exact" })
      .order("fecha_publicacion", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (search) q = q.or(`titulo.ilike.%${search}%,organismo.ilike.%${search}%,objeto.ilike.%${search}%`);
    if (estado) q = q.eq("estado_convocatoria", estado);
    if (ccaa) q = q.ilike("comunidad_autonoma", `%${ccaa}%`);
    if (soloAbiertas) q = q.eq("estado_convocatoria", "abierta");

    const { data, count, error } = await q;
    if (!error) {
      setSubvenciones(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [search, estado, ccaa, soloAbiertas, page]);

  // eslint-disable-next-line react-compiler/react-compiler
  useEffect(() => { cargar(); }, [cargar]);

  function aplicarBusqueda() {
    setSearch(searchInput);
    setPage(0);
  }

  function limpiarFiltros() {
    setSearch(""); setSearchInput(""); setEstado(""); setCcaa(""); setSoloAbiertas(false); setPage(0);
  }

  const filtrosActivos = search || estado || ccaa || soloAbiertas;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            Subvenciones
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>
            {total.toLocaleString()} convocatorias en base de datos
          </p>
        </div>
        <button
          onClick={cargar}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 500,
            background: "transparent", color: "var(--ink2)", border: "1px solid var(--border)",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Buscador + filtros */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && aplicarBusqueda()}
              placeholder="Buscar por título, organismo, objeto..."
              style={{
                width: "100%", padding: "9px 12px 9px 34px", borderRadius: 9,
                border: "1px solid var(--border)", fontSize: "0.85rem",
                background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={aplicarBusqueda}
            style={{
              padding: "9px 18px", borderRadius: 9, background: "var(--blue)", color: "#fff",
              border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, fontFamily: "inherit",
            }}
          >
            Buscar
          </button>
          <button
            onClick={() => setShowFiltros(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px", borderRadius: 9, fontSize: "0.82rem", fontWeight: 500,
              background: showFiltros ? "var(--blue-bg)" : "transparent",
              color: showFiltros ? "var(--blue)" : "var(--ink2)",
              border: "1px solid var(--border)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Filter size={14} /> Filtros {filtrosActivos ? "●" : ""}
            <ChevronDown size={13} style={{ transform: showFiltros ? "rotate(180deg)" : "none", transition: "0.2s" }} />
          </button>
        </div>

        {showFiltros && (
          <div style={{
            display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
            padding: "14px 16px", borderRadius: 10, background: "var(--surface)",
            border: "1px solid var(--border)",
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.83rem", color: "var(--ink2)", cursor: "pointer" }}>
              <input type="checkbox" checked={soloAbiertas} onChange={e => { setSoloAbiertas(e.target.checked); setEstado(""); setPage(0); }} />
              Solo abiertas
            </label>

            <select
              value={estado}
              onChange={e => { setEstado(e.target.value); setSoloAbiertas(false); setPage(0); }}
              style={{
                padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)",
                fontSize: "0.83rem", background: "var(--bg)", color: "var(--ink)",
              }}
            >
              <option value="">Todos los estados</option>
              <option value="abierta">Abierta</option>
              <option value="resuelta">Resuelta</option>
              <option value="cerrada">Cerrada</option>
              <option value="desconocido">Sin estado</option>
            </select>

            <select
              value={ccaa}
              onChange={e => { setCcaa(e.target.value); setPage(0); }}
              style={{
                padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)",
                fontSize: "0.83rem", background: "var(--bg)", color: "var(--ink)",
              }}
            >
              <option value="">Todas las CC.AA.</option>
              {CCAAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {filtrosActivos && (
              <button
                onClick={limpiarFiltros}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 7, fontSize: "0.8rem",
                  color: "#dc2626", background: "#fee2e2", border: "none", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <X size={12} /> Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", padding: "40px 0" }}>
          <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Cargando...
        </div>
      ) : subvenciones.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
          <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No se encontraron subvenciones con los filtros actuales.</p>
          {filtrosActivos && (
            <button onClick={limpiarFiltros} style={{ marginTop: 8, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>
              Quitar filtros
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {subvenciones.map(s => {
            const estadoInfo = ESTADO_LABEL[s.estado_convocatoria] ?? ESTADO_LABEL.desconocido;
            const dias = diasRestantes(s.plazo_fin);
            const urgente = dias !== null && dias >= 0 && dias <= 15;
            return (
              <div
                key={s.id}
                onClick={() => setSelected(s)}
                style={{
                  background: "var(--surface)", border: `1px solid ${urgente ? "#fca5a5" : "var(--border)"}`,
                  borderRadius: 12, padding: "16px 20px", cursor: "pointer",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{
                        padding: "2px 9px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600,
                        color: estadoInfo.color, background: estadoInfo.bg,
                      }}>
                        {estadoInfo.label}
                      </span>
                      {urgente && (
                        <span style={{
                          padding: "2px 9px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600,
                          color: "#dc2626", background: "#fee2e2",
                        }}>
                          ¡Cierra en {dias}d!
                        </span>
                      )}
                      {s.ia_confidence && s.ia_confidence >= 0.7 && (
                        <span style={{
                          padding: "2px 9px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600,
                          color: "#0284c7", background: "#e0f2fe",
                        }}>
                          IA procesada
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: "0.92rem", fontWeight: 600, color: "var(--ink)",
                      marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {s.titulo || `Convocatoria BDNS ${s.bdns_id}`}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                      {s.organismo && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "var(--muted)" }}>
                          <Building2 size={12} /> {s.organismo}
                        </span>
                      )}
                      {s.comunidad_autonoma && (
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                          {s.comunidad_autonoma}
                        </span>
                      )}
                      {s.fecha_publicacion && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "var(--muted)" }}>
                          <Calendar size={12} /> {fmtDate(s.fecha_publicacion)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {(s.importe_maximo || s.presupuesto_total) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginBottom: 4 }}>
                        <Euro size={13} style={{ color: "var(--blue)" }} />
                        <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--blue)" }}>
                          {fmt(s.importe_maximo) ?? fmt(s.presupuesto_total)}
                        </span>
                      </div>
                    )}
                    {s.plazo_fin && (
                      <div style={{ fontSize: "0.76rem", color: dias !== null && dias < 0 ? "var(--muted)" : dias !== null && dias <= 15 ? "#dc2626" : "var(--ink2)" }}>
                        {dias !== null && dias < 0 ? "Plazo cerrado" : `Plazo: ${fmtDate(s.plazo_fin)}`}
                      </div>
                    )}
                    {s.porcentaje_financiacion && (
                      <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 2 }}>
                        hasta {s.porcentaje_financiacion}% financiado
                      </div>
                    )}
                  </div>
                </div>
                {s.resumen_ia && (
                  <p style={{
                    fontSize: "0.78rem", color: "var(--muted)", marginTop: 8, marginBottom: 0,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {s.resumen_ia}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: page === 0 ? "var(--muted)" : "var(--ink2)",
              cursor: page === 0 ? "not-allowed" : "pointer", fontSize: "0.83rem", fontFamily: "inherit",
            }}
          >
            Anterior
          </button>
          <span style={{ padding: "7px 12px", fontSize: "0.83rem", color: "var(--muted)" }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: page >= totalPages - 1 ? "var(--muted)" : "var(--ink2)",
              cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", fontSize: "0.83rem", fontFamily: "inherit",
            }}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg)", borderRadius: 16, width: "100%", maxWidth: 640,
              maxHeight: "85vh", overflow: "auto", padding: "28px 30px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <span style={{
                padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600,
                color: (ESTADO_LABEL[selected.estado_convocatoria] ?? ESTADO_LABEL.desconocido).color,
                background: (ESTADO_LABEL[selected.estado_convocatoria] ?? ESTADO_LABEL.desconocido).bg,
              }}>
                {(ESTADO_LABEL[selected.estado_convocatoria] ?? ESTADO_LABEL.desconocido).label}
              </span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
              {selected.titulo || `Convocatoria BDNS ${selected.bdns_id}`}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 18 }}>
              {[
                { label: "Organismo", value: selected.organismo },
                { label: "Departamento", value: selected.departamento },
                { label: "Comunidad", value: selected.comunidad_autonoma },
                { label: "Ámbito", value: selected.ambito_geografico },
                { label: "Fecha publicación", value: fmtDate(selected.fecha_publicacion) },
                { label: "Plazo fin", value: fmtDate(selected.plazo_fin) },
                { label: "Importe máximo", value: fmt(selected.importe_maximo) },
                { label: "Presupuesto total", value: fmt(selected.presupuesto_total) },
                { label: "% Financiación", value: selected.porcentaje_financiacion ? `${selected.porcentaje_financiacion}%` : null },
                { label: "BDNS ID", value: selected.bdns_id },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--ink)", marginTop: 1 }}>{f.value}</div>
                </div>
              ))}
            </div>

            {selected.resumen_ia && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Resumen IA</div>
                <p style={{ fontSize: "0.85rem", color: "var(--ink2)", lineHeight: 1.6, margin: 0 }}>{selected.resumen_ia}</p>
              </div>
            )}

            {selected.objeto && !selected.resumen_ia && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Objeto</div>
                <p style={{ fontSize: "0.85rem", color: "var(--ink2)", lineHeight: 1.6, margin: 0 }}>{selected.objeto}</p>
              </div>
            )}

            {selected.para_quien && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Beneficiarios</div>
                <p style={{ fontSize: "0.85rem", color: "var(--ink2)", lineHeight: 1.6, margin: 0 }}>{selected.para_quien}</p>
              </div>
            )}

            {selected.url_oficial && (
              <a
                href={selected.url_oficial}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 18px", borderRadius: 9, marginTop: 8,
                  background: "var(--blue)", color: "#fff",
                  textDecoration: "none", fontSize: "0.85rem", fontWeight: 600,
                }}
              >
                <ExternalLink size={14} /> Ver convocatoria oficial
              </a>
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
