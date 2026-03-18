"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AIConfigPanel from "@/components/workspace/ai/AIConfigPanel";
import {
  Settings, Database, Brain, Download, FileText,
  Zap, Save, CheckCircle2, Loader2, Info,
} from "lucide-react";

// ─── Config del pipeline guardada en localStorage + DB ───────────────────────
interface PipelineConfig {
  limite_diario: number;
  dias_atras: number;        // cuántos días atrás buscar en cada ingesta
  descargar_pdfs: boolean;
  extraer_texto: boolean;
  analizar_con_ia: boolean;
  modelo_ia: string;         // modelo preferido para análisis (vacío = auto)
  max_paginas_pdf: number;   // máx páginas a procesar por PDF
}

const CONFIG_DEFAULT: PipelineConfig = {
  limite_diario: 30,
  dias_atras: 1,
  descargar_pdfs: true,
  extraer_texto: true,
  analizar_con_ia: true,
  modelo_ia: "",
  max_paginas_pdf: 50,
};

const STORAGE_KEY = "subvenciones_pipeline_config";

function loadConfig(): PipelineConfig {
  if (typeof window === "undefined") return CONFIG_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...CONFIG_DEFAULT, ...JSON.parse(raw) } : CONFIG_DEFAULT;
  } catch { return CONFIG_DEFAULT; }
}

function saveConfig(cfg: PipelineConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function AjustesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<PipelineConfig>(CONFIG_DEFAULT);
  const [saved, setSaved] = useState(false);
  const [proveedorActivo, setProveedorActivo] = useState<string | null>(null);
  const [cargandoProveedor, setCargandoProveedor] = useState(true);

  useEffect(() => {
    setConfig(loadConfig());
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    // Verificar proveedor IA configurado
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("ia_providers")
        .select("provider, enabled")
        .eq("enabled", true)
        .not("api_key", "is", null)
        .limit(1)
        .maybeSingle();
      setProveedorActivo(data?.provider ?? null);
      setCargandoProveedor(false);
    });
  }, []);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (field: Partial<PipelineConfig>) => setConfig(c => ({ ...c, ...field }));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <Settings size={22} color="var(--blue)" />
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            Ajustes
          </h1>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "2px 0 0" }}>
            Proveedores de IA y configuración del pipeline de subvenciones
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

        {/* ── Columna izquierda: Pipeline config ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Estado IA */}
          <div style={{
            padding: "14px 16px", borderRadius: 10,
            background: cargandoProveedor ? "var(--surface)" : proveedorActivo ? "#f0fdf4" : "#fffbeb",
            border: `1px solid ${cargandoProveedor ? "var(--border)" : proveedorActivo ? "#bbf7d0" : "#fde68a"}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            {cargandoProveedor ? (
              <Loader2 size={16} className="animate-spin" color="var(--muted)" />
            ) : proveedorActivo ? (
              <CheckCircle2 size={16} color="#22c55e" />
            ) : (
              <Info size={16} color="#d97706" />
            )}
            <div style={{ fontSize: "0.83rem" }}>
              {cargandoProveedor ? (
                <span style={{ color: "var(--muted)" }}>Verificando IA...</span>
              ) : proveedorActivo ? (
                <span style={{ color: "#166534" }}>
                  IA activa: <strong>{proveedorActivo}</strong> — el pipeline puede analizar PDFs con IA
                </span>
              ) : (
                <span style={{ color: "#92400e" }}>
                  Sin proveedor IA configurado — configura uno a la derecha para habilitar el análisis automático
                </span>
              )}
            </div>
          </div>

          {/* Fases del pipeline */}
          <Section icon={<Zap size={15} />} title="Fases del pipeline">
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 14px" }}>
              Activa o desactiva cada fase. Si desactivas IA, la ingesta guarda los datos básicos de BDNS igualmente.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Toggle
                icon={<Database size={14} />}
                label="Guardar datos BDNS"
                sublabel="Siempre activo — guarda el JSON crudo de cada convocatoria"
                checked={true}
                disabled
              />
              <Toggle
                icon={<Download size={14} />}
                label="Descargar PDFs"
                sublabel="Descarga el PDF oficial y lo guarda en Storage"
                checked={config.descargar_pdfs}
                onChange={v => update({ descargar_pdfs: v })}
              />
              <Toggle
                icon={<FileText size={14} />}
                label="Extraer texto del PDF"
                sublabel="Extrae el texto con pdfjs para pasarlo a la IA"
                checked={config.extraer_texto}
                disabled={!config.descargar_pdfs}
                onChange={v => update({ extraer_texto: v })}
              />
              <Toggle
                icon={<Brain size={14} />}
                label="Analizar con IA"
                sublabel="Extrae resumen, requisitos, plazos e importes estructurados"
                checked={config.analizar_con_ia}
                disabled={!proveedorActivo}
                onChange={v => update({ analizar_con_ia: v })}
              />
            </div>
          </Section>

          {/* Parámetros */}
          <Section icon={<Settings size={15} />} title="Parámetros de ingesta">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Convocatorias por ingesta" hint="Máx. por ejecución (seguridad timeout)">
                <input
                  type="number" min={5} max={200} value={config.limite_diario}
                  onChange={e => update({ limite_diario: Number(e.target.value) })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Días atrás a consultar" hint="Rango de fechas de cada ingesta">
                <input
                  type="number" min={1} max={30} value={config.dias_atras}
                  onChange={e => update({ dias_atras: Number(e.target.value) })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Máx. páginas por PDF" hint="PDFs muy largos se truncan">
                <input
                  type="number" min={5} max={200} value={config.max_paginas_pdf}
                  onChange={e => update({ max_paginas_pdf: Number(e.target.value) })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Modelo IA preferido" hint="Vacío = auto según proveedor">
                <input
                  type="text" value={config.modelo_ia} placeholder="ej: gpt-4o-mini"
                  onChange={e => update({ modelo_ia: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            </div>
          </Section>

          {/* Guardar */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleSave}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 20px", borderRadius: 8, border: "none",
                background: "var(--blue)", color: "#fff",
                fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
              {saved ? "Guardado" : "Guardar ajustes"}
            </button>
          </div>
        </div>

        {/* ── Columna derecha: Panel IA ── */}
        <div style={{
          background: "var(--surface)", borderRadius: 12,
          border: "1px solid var(--border)", overflow: "hidden",
          position: "sticky", top: 20,
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Brain size={15} color="var(--blue)" />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>
              Proveedores de IA
            </span>
          </div>
          {userId ? (
            <AIConfigPanel
              userId={userId}
              workspaceType="expediente"
              inline
              isOpen
            />
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: "0.83rem" }}>
              <Loader2 size={18} className="animate-spin" style={{ marginBottom: 8 }} />
              <div>Cargando...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 10,
      border: "1px solid var(--border)", overflow: "hidden",
    }}>
      <div style={{
        padding: "11px 16px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 7,
        background: "var(--bg)",
      }}>
        <span style={{ color: "var(--blue)" }}>{icon}</span>
        <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--ink)" }}>{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Toggle({
  icon, label, sublabel, checked, disabled, onChange,
}: {
  icon: React.ReactNode; label: string; sublabel: string;
  checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px", borderRadius: 8,
      background: checked && !disabled ? "var(--blue-bg)" : "var(--bg)",
      border: `1px solid ${checked && !disabled ? "var(--blue)" : "var(--border)"}`,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.15s",
    }}
      onClick={() => !disabled && onChange?.(!checked)}
    >
      <span style={{ color: checked && !disabled ? "var(--blue)" : "var(--muted)", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--ink)" }}>{label}</div>
        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{sublabel}</div>
      </div>
      <div style={{
        width: 34, height: 18, borderRadius: 9, flexShrink: 0,
        background: checked && !disabled ? "var(--blue)" : "var(--border)",
        position: "relative", transition: "background 0.15s",
      }}>
        <div style={{
          position: "absolute", top: 2, borderRadius: "50%",
          width: 14, height: 14, background: "#fff",
          left: checked && !disabled ? 18 : 2,
          transition: "left 0.15s",
        }} />
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--ink2)", marginBottom: 5 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 5 }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 7,
  border: "1px solid var(--border)", fontSize: "0.83rem",
  background: "var(--bg)", color: "var(--ink)", fontFamily: "inherit",
  boxSizing: "border-box",
};
