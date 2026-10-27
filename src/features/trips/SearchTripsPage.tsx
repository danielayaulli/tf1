import { useState } from "react";
import { APIProvider, Map, AdvancedMarker, Polyline } from "@vis.gl/react-google-maps";
import { Armchair, Car, Clock, MapPin, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { isInLima } from "../../lib/geo";
import type { LatLng } from "../../lib/geo";
import { distanceToPolylineMeters } from "../../lib/distance";
import { formatSexComposition } from "../../lib/composition";
import { fetchNearbyTrips, fetchTripRoutePoints, requestPickup } from "./api";
import type { NearbyTrip } from "./api";
import { TEST_MODE, TEST_TOLERANCE_M } from "../../lib/testMode";
import { fetchAhpProfiles, fetchRanking } from "../recommendation/api";
import type { AhpProfile, RankedTripResult, RankingResult } from "../recommendation/api";
import { isWatchlistClear } from "../../types/profile";
import { Avatar, BottomSheet, Button, Card, Chip, RatingStars } from "../../components/ui";

const LIMA_CENTER = { lat: -12.09, lng: -77.02 };
const TOLERANCE_M = TEST_MODE ? (TEST_TOLERANCE_M ?? 2000) : 150;

const AHP_PROFILE_LABELS: Record<AhpProfile, string> = {
  group_consensus: "Equilibrado (consenso del grupo)",
  prioriza_seguridad: "Priorizo seguridad",
  prioriza_rapidez: "Priorizo rapidez",
  default: "Pesos iguales",
};

const CRITERION_LABELS: Record<string, string> = {
  tiempo_espera: "tiempo de espera",
  calificacion: "calificación del conductor",
  seguridad_percibida: "seguridad percibida",
  asientos_libres: "asientos libres",
  distancia: "cercanía a tu ruta",
};

function orderByRanking(trips: NearbyTrip[], ranking: RankedTripResult[]): NearbyTrip[] {
  // OJO: no se puede usar `new Map(...)` (el `Map` global) en este archivo:
  // el import de `Map`, el componente de @vis.gl/react-google-maps, lo
  // sombrea. Se usa un objeto plano en su lugar.
  const position: Record<string, number> = {};
  ranking.forEach((r, i) => {
    position[r.trip_id] = i;
  });
  return [...trips].sort((a, b) => (position[a.trip_id] ?? 0) - (position[b.trip_id] ?? 0));
}

function SearchTripsForm() {
  const { profile } = useAuth();
  const watchlistBlocked = !!profile && !isWatchlistClear(profile.watchlist_status);

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

  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [ahpProfile, setAhpProfile] = useState<AhpProfile>("group_consensus");
  const [availableProfiles, setAvailableProfiles] = useState<AhpProfile[] | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  async function applyRanking(trips: NearbyTrip[], profile: AhpProfile) {
    setRankingLoading(true);
    try {
      const result = await fetchRanking(trips, { ahpProfile: profile });
      setRanking(result);
      if (result) {
        setResults(orderByRanking(trips, result.ranking));
        if (!availableProfiles) {
          const profiles = await fetchAhpProfiles();
          if (profiles) setAvailableProfiles(profiles);
        }
      }
    } finally {
      setRankingLoading(false);
    }
  }

  async function handleProfileChange(profile: AhpProfile) {
    setAhpProfile(profile);
    if (results.length > 0) await applyRanking(results, profile);
  }

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
      setRanking(null);
    }
  }

  async function handleSearch() {
    if (!searchPoint) return;
    setLoading(true);
    setError(null);
    setRanking(null);
    try {
      const trips = await fetchNearbyTrips(searchPoint, TOLERANCE_M);
      setResults(trips);
      setSearched(true);
      if (trips.length > 0) await applyRanking(trips, ahpProfile);
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
    <div className="relative h-dvh overflow-hidden bg-bg-page">
      <Map
        mapId="search-trips-map"
        defaultCenter={LIMA_CENTER}
        defaultZoom={12}
        disableDefaultUI
        className="h-full w-full"
        onClick={(e) => e.detail.latLng && handleMapClick(e.detail.latLng)}
      >
        {searchPoint && !requestingTripId && <AdvancedMarker position={searchPoint} title="Mi ubicación" />}
        {requestingTripId && tripRoute && <Polyline path={tripRoute} strokeColor="#1D4ED8" strokeWeight={4} />}
        {requestingTripId && pickupPoint && <AdvancedMarker position={pickupPoint} title="Punto de recojo" />}
      </Map>

      <BottomSheet className="flex flex-col gap-3 px-4 pb-4">
        <div>
          <h1 className="text-lg font-extrabold text-text-primary">Buscar viajes cercanos</h1>
          <p className="text-sm text-text-secondary">
            {requestingTripId
              ? "Elige en el mapa el punto donde quieres que te recojan sobre la ruta del viaje."
              : 'Haz clic en el mapa para marcar tu ubicación, luego pulsa "Buscar viajes".'}
          </p>
        </div>

        {error && <p className="rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}

        {!requestingTripId && (
          <Button onClick={handleSearch} disabled={!searchPoint || loading} loading={loading}>
            Buscar viajes
          </Button>
        )}

        {requestingTripId && (
          <div className="flex flex-col gap-2">
            {pickupDistance != null && (
              <p className="text-sm text-text-secondary">
                Tu punto de recojo está a ~{Math.round(pickupDistance)} m de la ruta
                {pickupDistance > TOLERANCE_M ? " (bastante lejos, considera elegir otro punto)" : ""}.
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleConfirmRequest} disabled={!pickupPoint || submitting} loading={submitting} className="flex-1">
                Confirmar solicitud
              </Button>
              <Button variant="secondary" onClick={handleCancelRequest}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {!requestingTripId && searched && results.length === 0 && (
          <p className="text-sm text-text-secondary">
            No hay viajes cuya ruta pase cerca de ese punto (a menos de {TOLERANCE_M} m).
          </p>
        )}

        {!requestingTripId && ranking && (
          <Card className="flex flex-col gap-2 bg-bg-sunken">
            <h3 className="text-sm font-bold text-text-primary">¿Cómo se ordenan estos viajes?</h3>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-text-secondary">Perfil de ranking</span>
              <select
                value={ahpProfile}
                onChange={(e) => handleProfileChange(e.target.value as AhpProfile)}
                disabled={rankingLoading}
                className="min-h-11 rounded-sm border-[1.5px] border-border-default bg-bg-surface px-3 text-base text-text-primary"
              >
                {(availableProfiles ?? [ahpProfile]).map((p) => (
                  <option key={p} value={p}>
                    {AHP_PROFILE_LABELS[p] ?? p}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-text-secondary">
              Pesos:{" "}
              {Object.entries(ranking.weights)
                .map(([criterio, peso]) => `${CRITERION_LABELS[criterio] ?? criterio} ${Math.round(peso * 100)}%`)
                .join(" · ")}
            </p>
            {!ranking.consistency.consistent && (
              <p className="text-xs font-medium text-error">
                Las matrices de comparación no son muy consistentes (CR={ranking.consistency.cr.toFixed(2)}); el
                ranking puede no reflejar bien las prioridades reales.
              </p>
            )}
          </Card>
        )}

        {!requestingTripId &&
          results.map((trip) => {
            const rankedInfo = ranking?.ranking.find((r) => r.trip_id === trip.trip_id);
            return (
              <Card key={trip.trip_id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-text-primary">{trip.avenida}</p>
                    <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {new Date(trip.departure_time).toLocaleString("es-PE")}
                    </p>
                  </div>
                  <Chip tone={trip.seats_available > 0 ? "success" : "neutral"} icon={<Armchair className="size-3.5" aria-hidden="true" />}>
                    {trip.seats_available}/{trip.seats_total}
                  </Chip>
                </div>

                <div className="flex items-center gap-2.5">
                  <Avatar name={trip.driver_nombre_pila} size={36} />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                      {trip.driver_nombre_pila}
                      {trip.driver_rating_avg != null && <RatingStars value={trip.driver_rating_avg} size={13} />}
                      <span className="font-normal text-text-secondary">
                        {trip.driver_rating_avg != null ? trip.driver_rating_avg.toFixed(1) : "sin calificaciones"}
                      </span>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <MapPin className="size-3.5" aria-hidden="true" />A ~{Math.round(trip.distance_m)} m de tu
                      ubicación
                    </p>
                  </div>
                </div>

                <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Users className="size-3.5" aria-hidden="true" />
                  {formatSexComposition(trip.men_count, trip.women_count)}
                </p>

                {trip.vehicle_placa && (
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Car className="size-3.5" aria-hidden="true" />
                    {trip.vehicle_modelo} {trip.vehicle_color} — placa {trip.vehicle_placa}
                  </p>
                )}

                {rankedInfo && (
                  <p className="rounded-sm bg-info-soft px-2.5 py-2 text-xs text-info">
                    Seguridad percibida: {Math.round(rankedInfo.seguridad_percibida)}/100 — {rankedInfo.explanation}
                  </p>
                )}

                {watchlistBlocked ? (
                  <p className="rounded-sm bg-warning-soft px-2.5 py-2 text-xs font-medium text-warning">
                    Estamos verificando tu información, te avisaremos. Mientras tanto no puedes solicitar viajes.
                  </p>
                ) : (
                  <Button
                    onClick={() => handleStartRequest(trip.trip_id)}
                    disabled={requestedTripIds.has(trip.trip_id)}
                  >
                    {requestedTripIds.has(trip.trip_id) ? "Solicitud enviada" : "Solicitar recojo"}
                  </Button>
                )}
              </Card>
            );
          })}
      </BottomSheet>
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
