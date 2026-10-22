import { useEffect, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useAuth } from "../auth/AuthContext";
import {
  fetchMyTrips,
  fetchRequestsForTrips,
  fetchTripRoutePoints,
  finishTrip,
  respondToRequest,
  startTrip,
} from "./api";
import type { PickupRequestWithPassenger } from "./api";
import type { Trip } from "../../types/trip";
import type { LatLng } from "../../lib/geo";
import { fetchRatingsGiven } from "../ratings/api";
import { RatingForm } from "../ratings/RatingForm";
import { LiveTripMap } from "../location/LiveTripMap";

function DriverLiveMap({
  tripId,
  driverId,
  labels,
}: {
  tripId: string;
  driverId: string;
  labels: Record<string, string>;
}) {
  const [route, setRoute] = useState<LatLng[] | null>(null);

  useEffect(() => {
    fetchTripRoutePoints(tripId).then(setRoute);
  }, [tripId]);

  if (!route || route.length === 0) return <p>Cargando mapa...</p>;

  return (
    <LiveTripMap
      tripId={tripId}
      route={route}
      center={route[0]}
      ownUserId={driverId}
      ownRole="driver"
      sharingActive
      labels={labels}
    />
  );
}

export function MyTripsPage() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [requestsByTrip, setRequestsByTrip] = useState<Map<string, PickupRequestWithPassenger[]>>(
    new Map(),
  );
  const [ratedPairs, setRatedPairs] = useState<Set<string>>(new Set());
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
      const finishedTripIds = myTrips.filter((t) => t.status === "finished").map((t) => t.id);
      const ratingsGiven = await fetchRatingsGiven(profile.id, finishedTripIds);
      setTrips(myTrips);
      setRequestsByTrip(grouped);
      setRatedPairs(new Set(ratingsGiven.map((r) => `${r.trip_id}:${r.rated_id}`)));
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

  async function handleFinish(tripId: string) {
    setError(null);
    try {
      await finishTrip(tripId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al finalizar el viaje.");
    }
  }

  async function handleStart(tripId: string) {
    setError(null);
    try {
      await startTrip(tripId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar el viaje.");
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
        const accepted = requests.filter((r) => r.status === "accepted");
        const labels = Object.fromEntries(
          accepted.map((r) => [r.passenger_id, r.passenger?.nombre_pila ?? "Pasajero"]),
        );
        return (
          <section key={trip.id} className="trip-card">
            <h2>{trip.avenida}</h2>
            <p>Salida: {new Date(trip.departure_time).toLocaleString("es-PE")}</p>
            <p>
              Asientos: {trip.seats_available} / {trip.seats_total} libres · Estado: {trip.status}
            </p>

            {trip.status === "scheduled" && (
              <button type="button" onClick={() => handleStart(trip.id)}>
                Iniciar viaje
              </button>
            )}
            {(trip.status === "scheduled" || trip.status === "ongoing") && (
              <button type="button" onClick={() => handleFinish(trip.id)}>
                Finalizar viaje
              </button>
            )}

            {trip.status === "ongoing" && profile && (
              <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                <DriverLiveMap tripId={trip.id} driverId={profile.id} labels={labels} />
              </APIProvider>
            )}

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

            {accepted.length > 0 && (
              <p>
                Pasajeros confirmados: {accepted.map((r) => r.passenger?.nombre_pila ?? "Pasajero").join(", ")}
              </p>
            )}

            {trip.status === "finished" && accepted.length > 0 && profile && (
              <div>
                <h3>Calificar pasajeros</h3>
                {accepted.map((req) =>
                  ratedPairs.has(`${trip.id}:${req.passenger_id}`) ? (
                    <p key={req.id}>Ya calificaste a {req.passenger?.nombre_pila ?? "este pasajero"}.</p>
                  ) : (
                    <RatingForm
                      key={req.id}
                      tripId={trip.id}
                      raterId={profile.id}
                      ratedId={req.passenger_id}
                      ratedName={req.passenger?.nombre_pila ?? "este pasajero"}
                      onSubmitted={loadData}
                    />
                  ),
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
