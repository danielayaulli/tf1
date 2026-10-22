import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APIProvider, Map, AdvancedMarker, Polyline, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useAuth } from "../auth/AuthContext";
import { isInLima } from "../../lib/geo";
import type { LatLng } from "../../lib/geo";
import { createTrip } from "./api";
import { fetchMyVehicle } from "../vehicles/api";
import type { Vehicle } from "../../types/vehicle";

const LIMA_CENTER = { lat: -12.09, lng: -77.02 };

type PickMode = "origin" | "destination" | null;

function PublishTripForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const routesLibrary = useMapsLibrary("routes");

  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [avenida, setAvenida] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [seatsTotal, setSeatsTotal] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchMyVehicle(profile.id).then(setVehicle);
  }, [profile]);

  function handleMapClick(latLng: LatLng) {
    if (!pickMode) return;
    if (!isInLima(latLng)) {
      setError("Ese punto está fuera de Lima Metropolitana. El servicio solo funciona en Lima.");
      return;
    }
    setError(null);
    setRoute(null);
    if (pickMode === "origin") setOrigin(latLng);
    else setDestination(latLng);
    setPickMode(null);
  }

  async function handleCalculateRoute() {
    if (!origin || !destination || !routesLibrary) return;
    setError(null);
    setCalculatingRoute(true);
    try {
      // google.maps.DirectionsService es la API legacy, ya no habilitada en
      // proyectos nuevos de Google Cloud; Route.computeRoutes es su
      // reemplazo (misma librería "routes", clase distinta).
      const result = await routesLibrary.Route.computeRoutes({
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        fields: ["path"],
      });
      const path = result.routes?.[0]?.path?.map((p) => ({ lat: p.lat, lng: p.lng }));
      if (!path || path.length < 2) {
        setError("No se pudo calcular una ruta entre esos dos puntos.");
        return;
      }
      setRoute(path);
    } catch {
      setError("No se pudo calcular la ruta. Intenta con otros puntos.");
    } finally {
      setCalculatingRoute(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!origin || !destination) {
      setError("Elige el origen y el destino en el mapa.");
      return;
    }
    if (!route) {
      setError("Calcula la ruta antes de publicar el viaje.");
      return;
    }
    if (!avenida.trim()) {
      setError("Indica la avenida principal de la ruta.");
      return;
    }
    if (!departureTime) {
      setError("Indica la hora de salida.");
      return;
    }
    if (new Date(departureTime).getTime() <= Date.now()) {
      setError("La hora de salida debe ser en el futuro.");
      return;
    }
    if (!profile) return;

    setSubmitting(true);
    try {
      await createTrip({
        driverId: profile.id,
        origin,
        destination,
        route,
        avenida: avenida.trim(),
        departureTime: new Date(departureTime).toISOString(),
        seatsTotal,
      });
      navigate("/conductor/mis-viajes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al publicar el viaje.");
    } finally {
      setSubmitting(false);
    }
  }

  if (vehicle === undefined) return <p>Cargando...</p>;

  if (vehicle === null) {
    return (
      <div className="trip-page">
        <h1>Publicar viaje</h1>
        <p>
          Antes de publicar un viaje debes registrar tu vehículo (placa, modelo, color y asientos).
        </p>
        <Link to="/conductor/vehiculo">Registrar mi vehículo</Link>
      </div>
    );
  }

  return (
    <div className="trip-page">
      <h1>Publicar viaje</h1>
      <p>
        Haz clic en "Elegir origen" y luego en el mapa; repite con "Elegir destino". Ambos
        puntos deben estar dentro de Lima Metropolitana.
      </p>

      <div className="map-controls">
        <button type="button" onClick={() => setPickMode("origin")} disabled={pickMode === "origin"}>
          Elegir origen {origin && "✓"}
        </button>
        <button
          type="button"
          onClick={() => setPickMode("destination")}
          disabled={pickMode === "destination"}
        >
          Elegir destino {destination && "✓"}
        </button>
        <button
          type="button"
          onClick={handleCalculateRoute}
          disabled={!origin || !destination || calculatingRoute}
        >
          {calculatingRoute ? "Calculando..." : "Calcular ruta"}
        </button>
      </div>

      <div className="map-container">
        <Map
          mapId="publish-trip-map"
          defaultCenter={LIMA_CENTER}
          defaultZoom={12}
          onClick={(e) => e.detail.latLng && handleMapClick(e.detail.latLng)}
        >
          {origin && <AdvancedMarker position={origin} title="Origen" />}
          {destination && <AdvancedMarker position={destination} title="Destino" />}
          {route && <Polyline path={route} strokeColor="#1a73e8" strokeWeight={4} />}
        </Map>
      </div>

      <form onSubmit={handleSubmit}>
        <label>
          Avenida principal
          <input
            value={avenida}
            onChange={(e) => setAvenida(e.target.value)}
            placeholder="Av. Javier Prado"
          />
        </label>
        <label>
          Hora de salida
          <input
            type="datetime-local"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
          />
        </label>
        <label>
          Asientos disponibles
          <input
            type="number"
            min={1}
            max={6}
            value={seatsTotal}
            onChange={(e) => setSeatsTotal(Number(e.target.value))}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Publicando..." : "Publicar viaje"}
        </button>
      </form>
    </div>
  );
}

export function PublishTripPage() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return (
    <APIProvider apiKey={apiKey}>
      <PublishTripForm />
    </APIProvider>
  );
}
