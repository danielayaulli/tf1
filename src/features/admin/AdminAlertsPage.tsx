import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fetchPendingAlerts, resolveAlert } from "./api";
import type { PendingAlert } from "./api";

function AlertRow({ alert, adminId, onResolved }: { alert: PendingAlert; adminId: string; onResolved: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(resolution: "descartada" | "confirmada") {
    if (!motivo.trim()) {
      setError("Indica un motivo antes de resolver la alerta.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resolveAlert({ alertId: alert.id, profileId: alert.profile_id, resolution, motivo: motivo.trim(), adminId });
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al resolver la alerta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="trip-card">
      <p>
        Usuario: {alert.profile?.nombres} {alert.profile?.apellidos} — DNI {alert.profile?.dni ?? "—"}
      </p>
      <p>Entrada coincidente: {alert.entry?.nombre_original ?? "—"}</p>
      <p>Similitud: {Math.round(alert.similitud * 100)}%</p>
      <p>Creada: {new Date(alert.creado_en).toLocaleString("es-PE")}</p>

      <label>
        Motivo de la decisión
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="button" onClick={() => handleResolve("descartada")} disabled={submitting}>
        Descartar (es un homónimo)
      </button>
      <button type="button" onClick={() => handleResolve("confirmada")} disabled={submitting}>
        Confirmar coincidencia
      </button>
    </section>
  );
}

export function AdminAlertsPage() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<PendingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await fetchPendingAlerts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las alertas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="trip-page">
      <h1>Alertas de tamizado pendientes</h1>
      {error && <p className="error">{error}</p>}
      {alerts.length === 0 && <p>No hay alertas pendientes.</p>}

      {profile &&
        alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} adminId={profile.id} onResolved={loadAlerts} />
        ))}
    </div>
  );
}
