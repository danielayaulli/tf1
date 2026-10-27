import { useEffect, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Car, Check, Clock, X } from "lucide-react";
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
import type { Trip, TripStatus } from "../../types/trip";
import type { LatLng } from "../../lib/geo";
import { fetchRatingsGiven } from "../ratings/api";
import { RatingForm } from "../ratings/RatingForm";
import { LiveTripMap } from "../location/LiveTripMap";
import { Avatar, Button, Card, Chip, EmptyState, RatingStars } from "../../components/ui";

const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  scheduled: "Programado",
  ongoing: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
};
const TRIP_STATUS_TONE: Record<TripStatus, "info" | "success" | "neutral" | "error"> = {
  scheduled: "info",
  ongoing: "success",
  finished: "neutral",
  cancelled: "error",
};

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

  if (!route || route.length === 0) return <p className="text-sm text-text-secondary">Cargando mapa...</p>;

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

  if (loading) return <p className="p-6 text-text-secondary">Cargando tus viajes...</p>;

  return (
    <div className="safe-x mx-auto min-h-dvh max-w-md bg-bg-page pb-14 pt-6">
      <h1 className="mb-4 text-xl font-extrabold text-text-primary">Mis viajes</h1>
      {error && <p className="mb-4 rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}
      {trips.length === 0 && <EmptyState icon={Car} title="Todavía no has publicado ningún viaje" />}

      <div className="flex flex-col gap-4">
        {trips.map((trip) => {
          const requests = requestsByTrip.get(trip.id) ?? [];
          const pending = requests.filter((r) => r.status === "pending");
          const accepted = requests.filter((r) => r.status === "accepted");
          const labels = Object.fromEntries(
            accepted.map((r) => [r.passenger_id, r.passenger?.nombre_pila ?? "Pasajero"]),
          );
          return (
            <Card key={trip.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-text-primary">{trip.avenida}</h2>
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {new Date(trip.departure_time).toLocaleString("es-PE")}
                  </p>
                </div>
                <Chip tone={TRIP_STATUS_TONE[trip.status]}>{TRIP_STATUS_LABEL[trip.status]}</Chip>
              </div>

              <p className="text-sm text-text-secondary">
                {trip.seats_available} / {trip.seats_total} asientos libres
              </p>

              <div className="flex gap-2">
                {trip.status === "scheduled" && (
                  <Button variant="secondary" onClick={() => handleStart(trip.id)}>
                    Iniciar viaje
                  </Button>
                )}
                {(trip.status === "scheduled" || trip.status === "ongoing") && (
                  <Button variant="danger" onClick={() => handleFinish(trip.id)}>
                    Finalizar viaje
                  </Button>
                )}
              </div>

              {trip.status === "ongoing" && profile && (
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                  <DriverLiveMap tripId={trip.id} driverId={profile.id} labels={labels} />
                </APIProvider>
              )}

              {pending.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-text-primary">Solicitudes pendientes</h3>
                  {pending.map((req) => (
                    <div key={req.id} className="flex items-center gap-2.5 rounded-lg bg-bg-sunken p-2.5">
                      <Avatar name={req.passenger?.nombre_pila ?? "?"} size={32} />
                      <div className="flex-1 text-sm">
                        <p className="font-semibold text-text-primary">{req.passenger?.nombre_pila ?? "Pasajero"}</p>
                        {req.passenger?.rating_avg != null ? (
                          <RatingStars value={req.passenger.rating_avg} size={12} />
                        ) : (
                          <span className="text-xs text-text-secondary">sin calificaciones</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRespond(req.id, true)}
                        aria-label={`Aceptar a ${req.passenger?.nombre_pila ?? "pasajero"}`}
                        className="inline-flex size-9 items-center justify-center rounded-full bg-success-soft text-success"
                      >
                        <Check className="size-4.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(req.id, false)}
                        aria-label={`Rechazar a ${req.passenger?.nombre_pila ?? "pasajero"}`}
                        className="inline-flex size-9 items-center justify-center rounded-full bg-error-soft text-error"
                      >
                        <X className="size-4.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {accepted.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-text-secondary">
                    Pasajeros confirmados
                  </p>
                  <div className="flex -space-x-2">
                    {accepted.map((r) => (
                      <div key={r.id} title={r.passenger?.nombre_pila ?? "Pasajero"} className="ring-2 ring-bg-surface rounded-full">
                        <Avatar name={r.passenger?.nombre_pila ?? "?"} size={32} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trip.status === "finished" && accepted.length > 0 && profile && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-text-primary">Calificar pasajeros</h3>
                  {accepted.map((req) =>
                    ratedPairs.has(`${trip.id}:${req.passenger_id}`) ? (
                      <p key={req.id} className="text-sm text-text-secondary">
                        Ya calificaste a {req.passenger?.nombre_pila ?? "este pasajero"}.
                      </p>
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
            </Card>
          );
        })}
      </div>
    </div>
  );
}
