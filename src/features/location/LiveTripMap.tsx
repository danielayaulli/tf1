import { useState } from "react";
import { Map, AdvancedMarker, Polyline } from "@vis.gl/react-google-maps";
import { Radio, ShieldAlert, WifiOff } from "lucide-react";
import type { LatLng } from "../../lib/geo";
import type { LiveLocationRole } from "../../types/location";
import { TEST_MODE } from "../../lib/testMode";
import { useLiveLocationSharing } from "./useLiveLocationSharing";
import { useLiveLocationViewers, isStale, secondsSince } from "./useLiveLocationViewers";
import { useOnlineStatus } from "./useOnlineStatus";
import { Chip } from "../../components/ui";

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
  driver: "#0B2559",
  passenger: "#16A34A",
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
    <div className="flex flex-col gap-2">
      {!online && (
        <p className="flex items-center gap-1.5 rounded-sm bg-error-soft px-2.5 py-2 text-xs font-medium text-error">
          <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
          Sin conexión a internet. Tu posición no se está enviando.
        </p>
      )}
      {sharingActive && sharing.permissionDenied && (
        <p className="flex items-center gap-1.5 rounded-sm bg-error-soft px-2.5 py-2 text-xs font-medium text-error">
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
          No se puede compartir tu ubicación porque el permiso está denegado. En iPhone: Ajustes → Safari →
          Ubicación → Permitir (o Ajustes → Privacidad → Localización → Safari).
        </p>
      )}
      {sharingActive && sharing.noSignal && !sharing.permissionDenied && (
        <p className="rounded-sm bg-warning-soft px-2.5 py-2 text-xs font-medium text-warning">
          Sin señal de GPS por ahora. Reintentando...
        </p>
      )}
      {sharingActive && !TEST_MODE && (
        <div className="flex items-center gap-2">
          <Chip tone={sharing.sharing ? "success" : "neutral"} icon={<Radio className="size-3.5" aria-hidden="true" />}>
            {sharing.sharing ? "Compartiendo tu ubicación" : "Tu ubicación se compartirá solo durante este viaje"}
          </Chip>
        </div>
      )}
      {sharingActive && TEST_MODE && (
        <p className="text-xs text-text-secondary">
          Modo prueba: haz clic en el mapa para fijar tu ubicación simulada (en vez del GPS real).
        </p>
      )}

      <div className="h-64 w-full overflow-hidden rounded-lg border border-border-subtle">
        <Map
          mapId={`live-trip-map-${tripId}`}
          defaultCenter={center}
          defaultZoom={13}
          disableDefaultUI
          className="h-full w-full"
          onClick={(e) => {
            if (TEST_MODE && e.detail.latLng) setManualPosition(e.detail.latLng);
          }}
        >
          {route.length > 1 && <Polyline path={route} strokeColor="#1D4ED8" strokeWeight={4} />}

          {points.map((p) => {
            const stale = isStale(p.recorded_at, now);
            const label =
              p.user_id === ownUserId ? "Tú" : labels?.[p.user_id] ?? (p.role === "driver" ? "Conductor" : "Pasajero");
            return (
              <AdvancedMarker key={p.user_id} position={{ lat: p.lat, lng: p.lng }} title={label}>
                <div
                  className="whitespace-nowrap rounded-full border-2 border-white px-2 py-0.5 text-xs font-bold text-white shadow-sm"
                  style={{ background: MARKER_COLOR[p.role], opacity: stale ? 0.55 : 1 }}
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
