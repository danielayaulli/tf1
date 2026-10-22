import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fetchMyTrips, fetchRequestsForTrips, respondToRequest } from "./api";
import type { PickupRequestWithPassenger } from "./api";
import type { Trip } from "../../types/trip";

export function MyTripsPage() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [requestsByTrip, setRequestsByTrip] = useState<Map<string, PickupRequestWithPassenger[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const myTrips = await fetchMyTrips(profile.id);
      const requests = await fetchRequestsForTrips(myTrips.map((t) => t.id));
      const grouped = new Map<string, PickupRequestWithPassenger[]>();
      for (const r of requests) {
        const list = grouped.get(r.trip_id) ?? [];
        list.push(r);
        grouped.set(r.trip_id, list);
      }
      setTrips(myTrips);
      setRequestsByTrip(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tus viajes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleRespond(requestId: string, accept: boolean) {
    setError(null);
    try {
      await respondToRequest(requestId, accept ? "accepted" : "rejected");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al responder la solicitud.");
    }
  }

  if (loading) return <p>Cargando tus viajes...</p>;

  return (
    <div className="trip-page">
      <h1>Mis viajes</h1>
      {error && <p className="error">{error}</p>}
      {trips.length === 0 && <p>Todavía no has publicado ningún viaje.</p>}

      {trips.map((trip) => {
        const requests = requestsByTrip.get(trip.id) ?? [];
        const pending = requests.filter((r) => r.status === "pending");
        return (
          <section key={trip.id} className="trip-card">
            <h2>{trip.avenida}</h2>
            <p>Salida: {new Date(trip.departure_time).toLocaleString("es-PE")}</p>
            <p>
              Asientos: {trip.seats_available} / {trip.seats_total} libres · Estado: {trip.status}
            </p>

            {pending.length > 0 && (
              <div>
                <h3>Solicitudes pendientes</h3>
                <ul>
                  {pending.map((req) => (
                    <li key={req.id}>
                      {req.passenger?.nombre_pila ?? "Pasajero"} —{" "}
                      {req.passenger?.rating_avg != null
                        ? `${req.passenger.rating_avg.toFixed(1)} ★`
                        : "sin calificaciones"}{" "}
                      <button onClick={() => handleRespond(req.id, true)}>Aceptar</button>
                      <button onClick={() => handleRespond(req.id, false)}>Rechazar</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requests.filter((r) => r.status === "accepted").length > 0 && (
              <p>
                Pasajeros confirmados:{" "}
                {requests
                  .filter((r) => r.status === "accepted")
                  .map((r) => r.passenger?.nombre_pila ?? "Pasajero")
                  .join(", ")}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
