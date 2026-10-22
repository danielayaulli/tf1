import { useState } from "react";
import { Map, AdvancedMarker, Polyline } from "@vis.gl/react-google-maps";
import type { LatLng } from "../../lib/geo";
import type { LiveLocationRole } from "../../types/location";
import { TEST_MODE } from "../../lib/testMode";
import { useLiveLocationSharing } from "./useLiveLocationSharing";
import { useLiveLocationViewers, isStale, secondsSince } from "./useLiveLocationViewers";
import { useOnlineStatus } from "./useOnlineStatus";

interface LiveTripMapProps {
  tripId: string;
  route: LatLng[];
  center: LatLng;
  ownUserId: string;
  ownRole: LiveLocationRole;
  /** true si este usuario debe estar compartiendo su posición ahora mismo (viaje en curso y, si es pasajero, con solicitud aceptada). */
  sharingActive: boolean;
  /** userId -> nombre a mostrar bajo el marcador (para los pasajeros que ve el conductor). */
  labels?: Record<string, string>;
}

const MARKER_COLOR: Record<LiveLocationRole, string> = {
  driver: "#1a73e8",
  passenger: "#188038",
};

export function LiveTripMap({
  tripId,
  route,
  center,
  ownUserId,
  ownRole,
  sharingActive,
  labels,
}: LiveTripMapProps) {
  const [manualPosition, setManualPosition] = useState<LatLng | null>(center);
  const sharing = useLiveLocationSharing(tripId, ownUserId, ownRole, sharingActive, manualPosition);
  const { points, now } = useLiveLocationViewers(tripId);
  const online = useOnlineStatus();

  return (
    <div>
      {!online && <p className="error">Sin conexión a internet. Tu posición no se está enviando.</p>}
      {sharingActive && sharing.permissionDenied && (
        <p className="error">
          No se puede compartir tu ubicación porque el permiso está denegado. En iPhone: Ajustes →
          Safari → Ubicación → Permitir (o Ajustes → Privacidad → Localización → Safari).
        </p>
      )}
      {sharingActive && sharing.noSignal && !sharing.permissionDenied && (
        <p className="error">Sin señal de GPS por ahora. Reintentando...</p>
      )}
      {sharingActive && !TEST_MODE && (
        <p>Tu ubicación se compartirá solo durante este viaje.{sharing.sharing ? " Compartiendo ahora." : ""}</p>
      )}
      {sharingActive && TEST_MODE && (
        <p>Modo prueba: haz clic en el mapa para fijar tu ubicación simulada (en vez del GPS real).</p>
      )}

      <div className="map-container">
        <Map
          mapId={`live-trip-map-${tripId}`}
          defaultCenter={center}
          defaultZoom={13}
          onClick={(e) => {
            if (TEST_MODE && e.detail.latLng) setManualPosition(e.detail.latLng);
          }}
        >
          {route.length > 1 && <Polyline path={route} strokeColor="#1a73e8" strokeWeight={4} />}

          {points.map((p) => {
            const stale = isStale(p.recorded_at, now);
            const label =
              p.user_id === ownUserId ? "Tú" : labels?.[p.user_id] ?? (p.role === "driver" ? "Conductor" : "Pasajero");
            return (
              <AdvancedMarker key={p.user_id} position={{ lat: p.lat, lng: p.lng }} title={label}>
                <div
                  style={{
                    background: MARKER_COLOR[p.role],
                    color: "white",
                    borderRadius: "999px",
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                    opacity: stale ? 0.5 : 1,
                    border: "2px solid white",
                  }}
                >
                  {label}
                  {stale && ` · hace ${secondsSince(p.recorded_at, now)}s`}
                </div>
              </AdvancedMarker>
            );
          })}

          {TEST_MODE && manualPosition && (
            <AdvancedMarker position={manualPosition} title="Tu ubicación simulada (modo prueba)" />
          )}
        </Map>
      </div>
    </div>
  );
}
