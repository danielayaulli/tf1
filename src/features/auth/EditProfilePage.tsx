import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { triggerWatchlistScreening, updateOwnNames } from "./api";

export function EditProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [nombres, setNombres] = useState(profile?.nombres ?? "");
  const [apellidos, setApellidos] = useState(profile?.apellidos ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombres.trim() || !apellidos.trim()) {
      setError("Completa nombres y apellidos.");
      return;
    }
    if (!profile) return;

    const changed = nombres.trim() !== profile.nombres || apellidos.trim() !== profile.apellidos;

    setSubmitting(true);
    try {
      await updateOwnNames(profile.id, { nombres: nombres.trim(), apellidos: apellidos.trim() });
      // Si cambió el nombre, se vuelve a tamizar contra el watchlist (ver
      // CLAUDE.md): un nombre nuevo es evidencia nueva.
      if (changed) await triggerWatchlistScreening();
      await refreshProfile();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Editar mi perfil</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Nombres
          <input required value={nombres} onChange={(e) => setNombres(e.target.value)} />
        </label>
        <label>
          Apellidos
          <input required value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar cambios"}
        </button>
        <button type="button" onClick={() => navigate("/")}>
          Cancelar
        </button>
      </form>
    </div>
  );
}
