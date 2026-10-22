import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchMyVehicle, upsertVehicle } from "./api";
import { isValidPlaca } from "./validation";

export function VehicleFormPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [color, setColor] = useState("");
  const [asientos, setAsientos] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchMyVehicle(profile.id)
      .then((vehicle) => {
        if (vehicle) {
          setPlaca(vehicle.placa);
          setModelo(vehicle.modelo);
          setColor(vehicle.color);
          setAsientos(vehicle.asientos);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar tu vehículo."))
      .finally(() => setLoading(false));
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPlaca(placa)) {
      setError("La placa no es válida (ej. ABC-123).");
      return;
    }
    if (!modelo.trim() || !color.trim()) {
      setError("Indica el modelo y el color del vehículo.");
      return;
    }
    if (!profile) return;

    setSubmitting(true);
    try {
      await upsertVehicle({ driverId: profile.id, placa, modelo: modelo.trim(), color: color.trim(), asientos });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el vehículo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="trip-page">
      <h1>Mi vehículo</h1>
      <p>Debes registrar tu vehículo antes de publicar un viaje. Tus pasajeros verán estos datos para identificar el carro.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Placa
          <input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC-123" />
        </label>
        <label>
          Modelo
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Toyota Yaris" />
        </label>
        <label>
          Color
          <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Gris" />
        </label>
        <label>
          Asientos para pasajeros
          <input
            type="number"
            min={1}
            max={6}
            value={asientos}
            onChange={(e) => setAsientos(Number(e.target.value))}
          />
        </label>

        {error && <p className="error">{error}</p>}
        {saved && <p>Vehículo guardado.</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar vehículo"}
        </button>
        <button type="button" onClick={() => navigate("/conductor/publicar")}>
          Ir a publicar viaje
        </button>
      </form>
    </div>
  );
}
