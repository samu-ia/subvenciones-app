"use client";

import { useEffect, useState } from "react";
import { Database, Cpu, Play, RefreshCw, Eye, EyeOff, CheckCircle, XCircle, Bell, Mail, MessageSquare, Send, Loader2 } from "lucide-react";

type Tab = "pipeline" | "ia" | "notif";

interface Stats {
  subvenciones: number;
  clientes: number;
  matches: number;
  solicitudes: number;
  expedientes: { total: number; activos: number; concedidos: number } | number;
}

interface LogEntry {
  id: string;
  created_at: string;
  modo: string;
  total_procesadas: number;
  nuevas: number;
  actualizadas: number;
  matches_generados: number;
  estado: string;
  error_msg: string | null;
}

interface IAProvider {
  id: string;
  provider: string;
  api_key: string | null;
  base_url: string | null;
  enabled: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  openrouter: "OpenRouter",
};

const CHEAP_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-haiku-20240307",
  google: "gemini-2.0-flash",
  openrouter: "openai/gpt-4o-mini",
};

export default function AjustesPage() {
  const [tab, setTab] = useState<Tab>("pipeline");

  // Pipeline state
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningMatch, setRunningMatch] = useState(false);
  const [limite, setLimite] = useState("50");
  const [fechaDesde, setFechaDesde] = useState("");
  const [soloNuevas, setSoloNuevas] = useState(true);
  const [pipelineMsg, setPipelineMsg] = useState("");

  // Notif state
  interface NotifChannelUI {
    canal: string; provider: string; enabled: boolean;
    from_name: string; from_address: string;
    config_masked: Record<string, string>;
    _edit: Record<string, string>; // live editable values (unmasked)
  }
  const [notifChannels, setNotifChannels] = useState<NotifChannelUI[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [savingNotif, setSavingNotif] = useState<Record<string, boolean>>({});
  const [testingNotif, setTestingNotif] = useState<Record<string, boolean>>({});
  const [testNotifTo, setTestNotifTo] = useState<Record<string, string>>({});
  const [notifMsg, setNotifMsg] = useState('');
  const [testNotifResult, setTestNotifResult] = useState<Record<string, string>>({});

  // IA state
  const [providers, setProviders] = useState<IAProvider[]>([]);
  const [loadingIA, setLoadingIA] = useState(true);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [editKeys, setEditKeys] = useState<Record<string, string>>({});
  const [savingIA, setSavingIA] = useState<Record<string, boolean>>({});
  const [testingIA, setTestingIA] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [iaMsg, setIaMsg] = useState("");

  async function fetchNotifChannels() {
    setLoadingNotif(true);
    try {
      const r = await fetch('/api/admin/notif-channels');
      if (r.ok) {
        const data = await r.json();
        setNotifChannels(data.map((c: Record<string, unknown>) => ({
          ...c,
          from_name: c.from_name ?? '',
          from_address: c.from_address ?? '',
          _edit: {},  // empty = show masked values
        })));
      }
    } finally { setLoadingNotif(false); }
  }

  async function saveNotifChannel(ch: NotifChannelUI) {
    setSavingNotif(prev => ({ ...prev, [ch.canal]: true }));
    setNotifMsg('');
    try {
      const r = await fetch(`/api/admin/notif-channels/${ch.canal}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: ch.enabled,
          from_name: ch.from_name,
          from_address: ch.from_address,
          provider: ch.provider,
          config: ch._edit,
        }),
      });
      if (r.ok) { setNotifMsg('Guardado correctamente'); fetchNotifChannels(); }
      else { const d = await r.json(); setNotifMsg(`Error: ${d.error}`); }
    } finally { setSavingNotif(prev => ({ ...prev, [ch.canal]: false })); }
  }

  async function testNotifChannel(ch: NotifChannelUI) {
    setTestingNotif(prev => ({ ...prev, [ch.canal]: true }));
    setTestNotifResult(prev => ({ ...prev, [ch.canal]: '' }));
    try {
      const r = await fetch(`/api/admin/notif-channels/${ch.canal}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testNotifTo[ch.canal] || undefined }),
      });
      const d = await r.json();
      setTestNotifResult(prev => ({ ...prev, [ch.canal]: r.ok ? 'ok' : (d.error ?? 'error') }));
    } finally { setTestingNotif(prev => ({ ...prev, [ch.canal]: false })); }
  }

  function updateNotifChannel(canal: string, field: string, value: unknown) {
    setNotifChannels(prev => prev.map(c => c.canal === canal ? { ...c, [field]: value } : c));
  }

  function updateNotifConfig(canal: string, key: string, value: string) {
    setNotifChannels(prev => prev.map(c =>
      c.canal === canal ? { ...c, _edit: { ...c._edit, [key]: value } } : c
    ));
  }

  useEffect(() => {
    fetchStats();
    fetchLogs();
  }, []);

  useEffect(() => {
    if (tab === "ia") fetchProviders();
    if (tab === "notif") fetchNotifChannels();
  }, [tab]);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const r = await fetch("/api/admin/stats");
      if (r.ok) setStats(await r.json());
    } finally {
      setLoadingStats(false);
    }
  }

  async function fetchLogs() {
    const r = await fetch("/api/admin/ingesta-logs");
    if (r.ok) setLogs(await r.json());
  }

  async function fetchProviders() {
    setLoadingIA(true);
    try {
      const r = await fetch("/api/admin/ia-providers");
      if (r.ok) {
        const data: IAProvider[] = await r.json();
        setProviders(data);
        const keys: Record<string, string> = {};
        data.forEach(p => { keys[p.id] = p.api_key ?? ""; });
        setEditKeys(keys);
      }
    } finally {
      setLoadingIA(false);
    }
  }

  async function runIngest() {
    setRunning(true);
    setPipelineMsg("");
    try {
      const body: Record<string, unknown> = { limite: parseInt(limite) || 50, soloNuevas };
      if (fechaDesde) body.fechaDesde = fechaDesde;
      const r = await fetch("/api/subvenciones/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok) {
        setPipelineMsg(`OK: ${data.nuevas ?? 0} nuevas, ${data.actualizadas ?? 0} actualizadas`);
      } else {
        setPipelineMsg(`Error: ${data.error ?? "desconocido"}`);
      }
      fetchStats();
      fetchLogs();
    } catch (e: unknown) {
      setPipelineMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  async function runMatching() {
    setRunningMatch(true);
    setPipelineMsg("");
    try {
      const r = await fetch("/api/matching/run", { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        setPipelineMsg(`Matching: ${data.nuevos ?? 0} nuevos, ${data.actualizados ?? 0} actualizados`);
      } else {
        setPipelineMsg(`Error: ${data.error ?? "desconocido"}`);
      }
      fetchStats();
    } catch (e: unknown) {
      setPipelineMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunningMatch(false);
    }
  }

  async function saveProvider(p: IAProvider) {
    setSavingIA(prev => ({ ...prev, [p.id]: true }));
    setIaMsg("");
    try {
      const r = await fetch(`/api/admin/ia-providers/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: editKeys[p.id] || null, enabled: p.enabled, base_url: p.base_url }),
      });
      if (r.ok) {
        setIaMsg(`${PROVIDER_LABELS[p.provider] ?? p.provider} guardado`);
        fetchProviders();
      } else {
        const d = await r.json();
        setIaMsg(`Error: ${d.error}`);
      }
    } finally {
      setSavingIA(prev => ({ ...prev, [p.id]: false }));
    }
  }

  async function testProvider(p: IAProvider) {
    setTestingIA(prev => ({ ...prev, [p.id]: true }));
    setTestResults(prev => ({ ...prev, [p.id]: "" }));
    try {
      const r = await fetch(`/api/admin/ia-providers/${p.id}/test`, { method: "POST" });
      const d = await r.json();
      setTestResults(prev => ({ ...prev, [p.id]: r.ok ? "ok" : d.error ?? "error" }));
    } finally {
      setTestingIA(prev => ({ ...prev, [p.id]: false }));
    }
  }

  function toggleEnabled(id: string) {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  }

  const tabStyle = (t: Tab) => ({
    padding: "8px 18px",
    borderRadius: 8,
    fontSize: "0.85rem",
    fontWeight: tab === t ? 600 : 500,
    color: tab === t ? "var(--blue)" : "var(--ink2)",
    background: tab === t ? "var(--blue-bg)" : "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)", marginBottom: 24 }}>
        Ajustes
      </h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        <button style={tabStyle("pipeline")} onClick={() => setTab("pipeline")}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Database size={15} /> Pipeline BDNS
          </span>
        </button>
        <button style={tabStyle("ia")} onClick={() => setTab("ia")}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={15} /> Proveedores IA
          </span>
        </button>
        <button style={tabStyle("notif")} onClick={() => setTab("notif")}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Bell size={15} /> Notificaciones
          </span>
        </button>
      </div>

      {/* PIPELINE TAB */}
      {tab === "pipeline" && (
        <div>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
            {loadingStats ? (
              <div style={{ gridColumn: "1/-1", color: "var(--muted)", fontSize: "0.85rem" }}>Cargando stats...</div>
            ) : stats ? (
              [
                { label: "Subvenciones", value: stats.subvenciones },
                { label: "Clientes", value: stats.clientes },
                { label: "Matches", value: stats.matches },
                { label: "Solicitudes", value: stats.solicitudes },
                { label: "Expedientes", value: typeof stats.expedientes === 'object' ? stats.expedientes.total : stats.expedientes },
              ].map(s => (
                <div key={s.label} style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)" }}>{s.value.toLocaleString()}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))
            ) : null}
          </div>

          {/* Ingest form */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 12, padding: "20px 22px", marginBottom: 20,
          }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>
              Ingestión BDNS
            </h3>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  Límite subvenciones
                </label>
                <input
                  type="number"
                  value={limite}
                  onChange={e => setLimite(e.target.value)}
                  style={{
                    width: 90, padding: "7px 10px", borderRadius: 7,
                    border: "1px solid var(--border)", fontSize: "0.85rem",
                    background: "var(--bg)", color: "var(--ink)",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  Desde fecha (opcional)
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={e => setFechaDesde(e.target.value)}
                  style={{
                    padding: "7px 10px", borderRadius: 7,
                    border: "1px solid var(--border)", fontSize: "0.85rem",
                    background: "var(--bg)", color: "var(--ink)",
                  }}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.85rem", color: "var(--ink2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={soloNuevas}
                  onChange={e => setSoloNuevas(e.target.checked)}
                />
                Solo nuevas
              </label>
              <button
                onClick={runIngest}
                disabled={running}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", borderRadius: 8,
                  background: "var(--blue)", color: "#fff",
                  border: "none", cursor: running ? "not-allowed" : "pointer",
                  fontSize: "0.85rem", fontWeight: 600, opacity: running ? 0.7 : 1,
                  fontFamily: "inherit",
                }}
              >
                {running ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={14} />}
                {running ? "Ejecutando..." : "Ejecutar ingestión"}
              </button>
              <button
                onClick={runMatching}
                disabled={runningMatch}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", borderRadius: 8,
                  background: "transparent", color: "var(--blue)",
                  border: "1px solid var(--blue)", cursor: runningMatch ? "not-allowed" : "pointer",
                  fontSize: "0.85rem", fontWeight: 600, opacity: runningMatch ? 0.7 : 1,
                  fontFamily: "inherit",
                }}
              >
                {runningMatch ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
                {runningMatch ? "Calculando..." : "Recalcular matching"}
              </button>
            </div>
            {pipelineMsg && (
              <div style={{
                marginTop: 12, padding: "8px 12px", borderRadius: 7,
                background: pipelineMsg.startsWith("Error") ? "#fee2e2" : "#dcfce7",
                color: pipelineMsg.startsWith("Error") ? "#dc2626" : "#16a34a",
                fontSize: "0.82rem",
              }}>
                {pipelineMsg}
              </div>
            )}
          </div>

          {/* Cron info */}
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 10, padding: "12px 16px", marginBottom: 24,
            fontSize: "0.82rem", color: "#92400e",
          }}>
            <strong>Cron automático:</strong> En Vercel añade en <code>vercel.json</code>:
            {" "}<code>{`{"crons":[{"path":"/api/subvenciones/ingest","schedule":"0 3 * * *"}]}`}</code>
            {" "}— se ejecuta diariamente a las 3:00 UTC con autenticación INGEST_SECRET.
          </div>

          {/* Logs */}
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
            Historial de ingestiones
          </h3>
          {logs.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Sin registros aún.</p>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2, var(--surface))" }}>
                    {["Fecha", "Modo", "Procesadas", "Nuevas", "Actualizadas", "Matches", "Estado"].map(h => (
                      <th key={h} style={{
                        padding: "9px 12px", textAlign: "left",
                        color: "var(--muted)", fontWeight: 600,
                        borderBottom: "1px solid var(--border)",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 20).map((l, i) => (
                    <tr key={l.id} style={{ background: i % 2 === 0 ? "transparent" : "var(--surface)" }}>
                      <td style={{ padding: "8px 12px", color: "var(--ink2)" }}>
                        {new Date(l.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td style={{ padding: "8px 12px", color: "var(--ink2)" }}>{l.modo ?? "-"}</td>
                      <td style={{ padding: "8px 12px", color: "var(--ink)" }}>{l.total_procesadas ?? 0}</td>
                      <td style={{ padding: "8px 12px", color: "#16a34a", fontWeight: 600 }}>{l.nuevas ?? 0}</td>
                      <td style={{ padding: "8px 12px", color: "var(--ink2)" }}>{l.actualizadas ?? 0}</td>
                      <td style={{ padding: "8px 12px", color: "var(--blue)" }}>{l.matches_generados ?? 0}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600,
                          background: l.estado === "completado" ? "#dcfce7" : l.estado === "error" ? "#fee2e2" : "#fef9c3",
                          color: l.estado === "completado" ? "#16a34a" : l.estado === "error" ? "#dc2626" : "#854d0e",
                        }}>
                          {l.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* IA TAB */}
      {tab === "ia" && (
        <div>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 20 }}>
            Configura las claves API de los proveedores de IA. El sistema usará el proveedor activo
            con modelos económicos para procesamiento masivo.
          </p>

          {loadingIA ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Cargando proveedores...</p>
          ) : providers.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No hay proveedores configurados.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {providers.map(p => (
                <div key={p.id} style={{
                  background: "var(--surface)", border: `1px solid ${p.enabled ? "var(--blue)" : "var(--border)"}`,
                  borderRadius: 12, padding: "18px 20px",
                  opacity: p.enabled ? 1 : 0.7,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>
                        {PROVIDER_LABELS[p.provider] ?? p.provider}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
                        Modelo económico: <code>{CHEAP_MODELS[p.provider] ?? "—"}</code>
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <span style={{ fontSize: "0.82rem", color: p.enabled ? "var(--blue)" : "var(--muted)", fontWeight: 500 }}>
                        {p.enabled ? "Activo" : "Inactivo"}
                      </span>
                      <div
                        onClick={() => toggleEnabled(p.id)}
                        style={{
                          width: 38, height: 20, borderRadius: 20,
                          background: p.enabled ? "var(--blue)" : "var(--border)",
                          position: "relative", cursor: "pointer", transition: "background 0.2s",
                        }}
                      >
                        <div style={{
                          position: "absolute", top: 2,
                          left: p.enabled ? 20 : 2,
                          width: 16, height: 16, borderRadius: "50%",
                          background: "#fff", transition: "left 0.2s",
                        }} />
                      </div>
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        type={showKeys[p.id] ? "text" : "password"}
                        value={editKeys[p.id] ?? ""}
                        onChange={e => setEditKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="API Key..."
                        style={{
                          width: "100%", padding: "8px 36px 8px 10px", borderRadius: 8,
                          border: "1px solid var(--border)", fontSize: "0.85rem",
                          background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box",
                          fontFamily: "monospace",
                        }}
                      />
                      <button
                        onClick={() => setShowKeys(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                        style={{
                          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0,
                        }}
                      >
                        {showKeys[p.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button
                      onClick={() => saveProvider(p)}
                      disabled={savingIA[p.id]}
                      style={{
                        padding: "8px 16px", borderRadius: 8,
                        background: "var(--blue)", color: "#fff",
                        border: "none", cursor: savingIA[p.id] ? "not-allowed" : "pointer",
                        fontSize: "0.82rem", fontWeight: 600, opacity: savingIA[p.id] ? 0.7 : 1,
                        fontFamily: "inherit", whiteSpace: "nowrap",
                      }}
                    >
                      {savingIA[p.id] ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => testProvider(p)}
                      disabled={testingIA[p.id] || !editKeys[p.id]}
                      style={{
                        padding: "8px 14px", borderRadius: 8,
                        background: "transparent", color: "var(--ink2)",
                        border: "1px solid var(--border)", cursor: "pointer",
                        fontSize: "0.82rem", fontWeight: 500, opacity: testingIA[p.id] ? 0.7 : 1,
                        fontFamily: "inherit", whiteSpace: "nowrap",
                      }}
                    >
                      {testingIA[p.id] ? "Probando..." : "Probar"}
                    </button>
                  </div>

                  {testResults[p.id] && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: "0.8rem",
                      color: testResults[p.id] === "ok" ? "#16a34a" : "#dc2626",
                    }}>
                      {testResults[p.id] === "ok"
                        ? <><CheckCircle size={13} /> Conexión correcta</>
                        : <><XCircle size={13} /> {testResults[p.id]}</>
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {iaMsg && (
            <div style={{
              marginTop: 16, padding: "8px 12px", borderRadius: 7,
              background: iaMsg.startsWith("Error") ? "#fee2e2" : "#dcfce7",
              color: iaMsg.startsWith("Error") ? "#dc2626" : "#16a34a",
              fontSize: "0.82rem",
            }}>
              {iaMsg}
            </div>
          )}
        </div>
      )}

      {/* NOTIFICACIONES TAB */}
      {tab === "notif" && (
        <div>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 24 }}>
            Configura el envío automático de notificaciones a clientes cuando detectes una subvención relevante.
            Puedes activar email (Resend) y/o WhatsApp (Twilio).
          </p>

          {loadingNotif ? (
            <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Cargando...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {notifChannels.map(ch => {
                const isEmail = ch.canal === 'email';
                const Icon = isEmail ? Mail : MessageSquare;
                const fields = isEmail
                  ? [{ key: 'api_key', label: 'API Key (Resend)', placeholder: 're_xxxxxxxxxxxx', type: 'password' }]
                  : [
                      { key: 'account_sid', label: 'Account SID (Twilio)', placeholder: 'ACxxxxxxxxxx', type: 'text' },
                      { key: 'auth_token', label: 'Auth Token (Twilio)', placeholder: '••••••••••••', type: 'password' },
                    ];

                return (
                  <div key={ch.canal} style={{
                    background: "var(--surface)", border: `1px solid ${ch.enabled ? "var(--blue)" : "var(--border)"}`,
                    borderRadius: 12, padding: "20px 22px",
                  }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: ch.enabled ? "var(--blue-bg)" : "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={18} color={ch.enabled ? "var(--blue)" : "var(--muted)"} />
                        </div>
                        <div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
                            {isEmail ? 'Email (Resend)' : 'WhatsApp (Twilio)'}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                            {isEmail
                              ? 'Envía emails HTML con los detalles de la subvención'
                              : 'Envía mensajes WhatsApp al móvil del cliente'}
                          </div>
                        </div>
                      </div>
                      {/* Toggle */}
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--ink2)" }}>{ch.enabled ? "Activo" : "Inactivo"}</span>
                        <div
                          onClick={() => updateNotifChannel(ch.canal, 'enabled', !ch.enabled)}
                          style={{
                            width: 42, height: 24, borderRadius: 12,
                            background: ch.enabled ? "var(--blue)" : "var(--border)",
                            position: "relative", cursor: "pointer", transition: "background 0.2s",
                          }}
                        >
                          <div style={{
                            position: "absolute", top: 3,
                            left: ch.enabled ? 21 : 3,
                            width: 18, height: 18, borderRadius: "50%",
                            background: "#fff", transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          }} />
                        </div>
                      </label>
                    </div>

                    {/* Remitente */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                          Nombre remitente
                        </label>
                        <input
                          value={ch.from_name}
                          onChange={e => updateNotifChannel(ch.canal, 'from_name', e.target.value)}
                          placeholder="AyudaPyme"
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", fontSize: "0.85rem", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                          {isEmail ? 'Email remitente' : 'Número WhatsApp (+34...)'}
                        </label>
                        <input
                          value={ch.from_address}
                          onChange={e => updateNotifChannel(ch.canal, 'from_address', e.target.value)}
                          placeholder={isEmail ? "hola@ayudapyme.es" : "+34600000000"}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", fontSize: "0.85rem", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Credenciales */}
                    <div style={{ display: "grid", gridTemplateColumns: isEmail ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 18 }}>
                      {fields.map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                            {f.label}
                          </label>
                          <input
                            type={f.type}
                            value={ch._edit[f.key] ?? ch.config_masked[f.key] ?? ''}
                            onChange={e => updateNotifConfig(ch.canal, f.key, e.target.value)}
                            onFocus={e => { if (e.target.value.includes('•')) updateNotifConfig(ch.canal, f.key, ''); }}
                            placeholder={f.placeholder}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid var(--border)", fontSize: "0.85rem", background: "var(--bg)", color: "var(--ink)", boxSizing: "border-box", fontFamily: "monospace" }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => saveNotifChannel(ch)}
                        disabled={savingNotif[ch.canal]}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 16px", borderRadius: 8,
                          background: "var(--blue)", color: "#fff",
                          border: "none", cursor: savingNotif[ch.canal] ? "not-allowed" : "pointer",
                          fontSize: "0.83rem", fontWeight: 600, opacity: savingNotif[ch.canal] ? 0.7 : 1,
                          fontFamily: "inherit",
                        }}
                      >
                        {savingNotif[ch.canal] ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle size={13} />}
                        Guardar
                      </button>

                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          value={testNotifTo[ch.canal] ?? ''}
                          onChange={e => setTestNotifTo(prev => ({ ...prev, [ch.canal]: e.target.value }))}
                          placeholder={isEmail ? "prueba@tuempresa.es" : "+34600000000"}
                          style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", fontSize: "0.82rem", background: "var(--bg)", color: "var(--ink)", width: 190 }}
                        />
                        <button
                          onClick={() => testNotifChannel(ch)}
                          disabled={testingNotif[ch.canal]}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "8px 14px", borderRadius: 8,
                            background: "transparent", color: "var(--ink2)",
                            border: "1px solid var(--border)", cursor: "pointer",
                            fontSize: "0.82rem", fontWeight: 500, opacity: testingNotif[ch.canal] ? 0.7 : 1,
                            fontFamily: "inherit",
                          }}
                        >
                          {testingNotif[ch.canal] ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
                          Enviar prueba
                        </button>
                      </div>

                      {testNotifResult[ch.canal] && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem",
                          color: testNotifResult[ch.canal] === 'ok' ? "#16a34a" : "#dc2626" }}>
                          {testNotifResult[ch.canal] === 'ok'
                            ? <><CheckCircle size={13} /> Enviado correctamente</>
                            : <><XCircle size={13} /> {testNotifResult[ch.canal]}</>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {notifChannels.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: "0.85rem" }}>
                  No hay canales. Ejecuta la migración de BD para crearlos.
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div style={{ marginTop: 24, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", fontSize: "0.82rem", color: "#92400e" }}>
            <strong>Cómo funciona:</strong> Al clicar "Notificar al cliente" en Novedades → Oportunidades,
            el sistema envía automáticamente un email y/o WhatsApp al cliente con los detalles de la subvención y
            un enlace a su portal para que pueda solicitar la ayuda directamente.
            El canal debe estar activo y el cliente debe tener email/teléfono registrado.
          </div>

          {notifMsg && (
            <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 7,
              background: notifMsg.startsWith("Error") ? "#fee2e2" : "#dcfce7",
              color: notifMsg.startsWith("Error") ? "#dc2626" : "#16a34a",
              fontSize: "0.82rem" }}>
              {notifMsg}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
