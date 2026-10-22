import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { logoutUser } from "./api";

export function HomePage() {
  const { profile } = useAuth();

  const roles = [
    profile?.is_passenger && "pasajero",
    profile?.is_driver && "conductor",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <h1>Hola, {profile?.nombres}</h1>
      <p>Estado de verificación: {profile?.verification_status}</p>
      <p>Roles: {roles}</p>
      <p>
        Tu calificación:{" "}
        {profile?.rating_avg != null
          ? `${profile.rating_avg.toFixed(1)} ★ (${profile.rating_count} ${profile.rating_count === 1 ? "calificación" : "calificaciones"})`
          : "sin calificaciones todavía"}
      </p>

      {profile?.is_driver && (
        <nav>
          <Link to="/conductor/vehiculo">Mi vehículo</Link>
          {" · "}
          <Link to="/conductor/publicar">Publicar viaje</Link>
          {" · "}
          <Link to="/conductor/mis-viajes">Mis viajes</Link>
        </nav>
      )}

      {profile?.is_passenger && (
        <nav>
          <Link to="/pasajero/buscar">Buscar viajes</Link>
          {" · "}
          <Link to="/pasajero/mis-solicitudes">Mis solicitudes</Link>
        </nav>
      )}

      <button onClick={() => logoutUser()}>Cerrar sesión</button>
    </div>
  );
}
