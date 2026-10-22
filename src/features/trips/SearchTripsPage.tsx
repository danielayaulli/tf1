import { useState } from "react";
import { APIProvider, Map, AdvancedMarker, Polyline } from "@vis.gl/react-google-maps";
import { useAuth } from "../auth/AuthContext";
import { isInLima } from "../../lib/geo";
import type { LatLng } from "../../lib/geo";
import { distanceToPolylineMeters } from "../../lib/distance";
import { formatSexComposition } from "../../lib/composition";
import { fetchNearbyTrips, fetchTripRoutePoints, requestPickup } from "./api";
import type { NearbyTrip } from "./api";

const LIMA_CENTER = { lat: -12.09, lng: -77.02 };
const TOLERANCE_M = 150;

function SearchTripsForm() {
  const { profile } = useAuth();

  const [searchPoint, setSearchPoint] = useState<LatLng | null>(null);
  const [results, setResults] = useState<NearbyTrip[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestingTripId, setRequestingTripId] = useState<string | null>(null);
  const [tripRoute, setTripRoute] = useState<LatLng[] | null>(null);
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestedTripIds, setRequestedTripIds] = useState<Set<string>>(new Set());

  function handleMapClick(latLng: LatLng) {
    if (!isInLima(latLng)) {
      setError("Ese punto está fuera de Lima Metropolitana.");
      return;
    }
    setError(null);
    if (requestingTripId) {
      setPickupPoint(latLng);
    } else {
      setSearchPoint(latLng);
      setResults([]);
      setSearched(false);
    }
  }

  async function handleSearch() {
    if (!searchPoint) return;
    setLoading(true);
    setError(null);
    try {
      const trips = await fetchNearbyTrips(searchPoint, TOLERANCE_M);
      setResults(trips);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar viajes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartRequest(tripId: string) {
    setError(null);
    setRequestingTripId(tripId);
    setPickupPoint(searchPoint);
    setTripRoute(null);
    try {
      const points = await fetchTripRoutePoints(tripId);
      setTripRoute(points);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la ruta del viaje.");
    }
  }

  function handleCancelRequest() {
    setRequestingTripId(null);
    setTripRoute(null);
    setPickupPoint(searchPoint);
  }

  async function handleConfirmRequest() {
    if (!requestingTripId || !pickupPoint || !profile) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPickup({ tripId: requestingTripId, passengerId: profile.id, pickupPoint });
      setRequestedTripIds((prev) => new Set(prev).add(requestingTripId));
      handleCancelRequest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  }

  const pickupDistance =
    requestingTripId && pickupPoint && tripRoute
      ? distanceToPolylineMeters(pickupPoint, tripRoute)
      : null;

  return (
    <div className="trip-page">
      <h1>Buscar viajes cercanos</h1>

      {!requestingTripId && (
        <p>Haz clic en el mapa para marcar tu ubicación, luego pulsa "Buscar viajes".</p>
      )}
      {requestingTripId && (
        <p>Elige en el mapa el punto donde quieres que te recojan sobre la ruta del viaje.</p>
      )}

      <div className="map-container">
        <Map mapId="search-trips-map" defaultCenter={LIMA_CENTER} defaultZoom={12} onClick={(e) => e.detail.latLng && handleMapClick(e.detail.latLng)}>
          {searchPoint && !requestingTripId && (
            <AdvancedMarker position={searchPoint} title="Mi ubicación" />
          )}
          {requestingTripId && tripRoute && (
            <Polyline path={tripRoute} strokeColor="#1a73e8" strokeWeight={4} />
          )}
          {requestingTripId && pickupPoint && (
            <AdvancedMarker position={pickupPoint} title="Punto de recojo" />
          )}
        </Map>
      </div>

      {error && <p className="error">{error}</p>}

      {!requestingTripId && (
        <div className="map-controls">
          <button type="button" onClick={handleSearch} disabled={!searchPoint || loading}>
            {loading ? "Buscando..." : "Buscar viajes"}
          </button>
        </div>
      )}

      {requestingTripId && (
        <div>
          {pickupDistance != null && (
            <p>
              Tu punto de recojo está a ~{Math.round(pickupDistance)} m de la ruta
              {pickupDistance > TOLERANCE_M ? " (bastante lejos, considera elegir otro punto)" : ""}.
            </p>
          )}
          <div className="map-controls">
            <button type="button" onClick={handleConfirmRequest} disabled={!pickupPoint || submitting}>
              {submitting ? "Enviando..." : "Confirmar solicitud"}
            </button>
            <button type="button" onClick={handleCancelRequest}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!requestingTripId && searched && results.length === 0 && (
        <p>No hay viajes cuya ruta pase cerca de ese punto (a menos de {TOLERANCE_M} m).</p>
      )}

      {!requestingTripId &&
        results.map((trip) => (
          <section key={trip.trip_id} className="trip-card">
            <h2>{trip.avenida}</h2>
            <p>Salida: {new Date(trip.departure_time).toLocaleString("es-PE")}</p>
            <p>
              Conductor: {trip.driver_nombre_pila} —{" "}
              {trip.driver_rating_avg != null ? `${trip.driver_rating_avg.toFixed(1)} ★` : "sin calificaciones"}
            </p>
            <p>
              Asientos: {trip.seats_available} / {trip.seats_total} libres · A ~
              {Math.round(trip.distance_m)} m de tu ubicación
            </p>
            <p>Pasajeros confirmados: {formatSexComposition(trip.men_count, trip.women_count)}</p>
            <button
              type="button"
              onClick={() => handleStartRequest(trip.trip_id)}
              disabled={requestedTripIds.has(trip.trip_id)}
            >
              {requestedTripIds.has(trip.trip_id) ? "Solicitud enviada" : "Solicitar recojo"}
            </button>
          </section>
        ))}
    </div>
  );
}

export function SearchTripsPage() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return (
    <APIProvider apiKey={apiKey}>
      <SearchTripsForm />
    </APIProvider>
  );
}
