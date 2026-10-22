import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fetchMyRequests } from "../trips/api";
import type { PickupRequestWithTrip } from "../trips/api";
import { fetchRatingsGiven } from "./api";
import { RatingForm } from "./RatingForm";

export function MyRequestsPage() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<PickupRequestWithTrip[]>([]);
  const [ratedTripIds, setRatedTripIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const myRequests = await fetchMyRequests(profile.id);
      const finishedTripIds = myRequests
        .filter((r) => r.status === "accepted" && r.trip?.status === "finished")
        .map((r) => r.trip_id);
      const ratingsGiven = await fetchRatingsGiven(profile.id, finishedTripIds);
      setRequests(myRequests);
      setRatedTripIds(new Set(ratingsGiven.map((r) => r.trip_id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tus solicitudes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (loading) return <p>Cargando tus solicitudes...</p>;

  return (
    <div className="trip-page">
      <h1>Mis solicitudes</h1>
      {error && <p className="error">{error}</p>}
      {requests.length === 0 && <p>Todavía no has solicitado ningún recojo.</p>}

      {requests.map((req) => (
        <section key={req.id} className="trip-card">
          <h2>{req.trip?.avenida ?? "Viaje"}</h2>
          {req.trip && <p>Salida: {new Date(req.trip.departure_time).toLocaleString("es-PE")}</p>}
          <p>
            Conductor: {req.driver?.nombre_pila ?? "—"} · Estado de tu solicitud: {req.status} · Estado del
            viaje: {req.trip?.status ?? "—"}
          </p>

          {req.status === "accepted" &&
            req.trip?.status === "finished" &&
            profile &&
            req.driver &&
            (ratedTripIds.has(req.trip_id) ? (
              <p>Ya calificaste a {req.driver.nombre_pila}.</p>
            ) : (
              <RatingForm
                tripId={req.trip_id}
                raterId={profile.id}
                ratedId={req.driver.id}
                ratedName={req.driver.nombre_pila}
                onSubmitted={loadData}
              />
            ))}
        </section>
      ))}
    </div>
  );
}
