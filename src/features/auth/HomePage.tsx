import { Link } from "react-router-dom";
import { Car, ClipboardList, Pencil, Search, Shield, ShieldCheck } from "lucide-react";
import { useAuth } from "./AuthContext";
import { logoutUser } from "./api";
import { isWatchlistClear } from "../../types/profile";
import { Avatar, Button, Card, Chip, GradientHero, RatingStars } from "../../components/ui";

export function HomePage() {
  const { profile } = useAuth();

  const roles = [profile?.is_passenger && "pasajero", profile?.is_driver && "conductor"]
    .filter(Boolean)
    .join(", ");

  const watchlistClear = !profile || isWatchlistClear(profile.watchlist_status);

  return (
    <div className="min-h-dvh bg-bg-page pb-14">
      <GradientHero intensity="soft" className="flex items-center gap-4 pb-8 pt-6">
        <Avatar name={profile?.nombres ?? "?"} size={56} />
        <div>
          <h1 className="text-xl font-extrabold">Hola, {profile?.nombres}</h1>
          <p className="text-sm text-white/80">{roles}</p>
          <div className="mt-1.5 flex items-center gap-2">
            {profile?.rating_avg != null ? (
              <>
                <RatingStars value={profile.rating_avg} size={15} />
                <span className="text-sm text-white/85">
                  {profile.rating_avg.toFixed(1)} ({profile.rating_count}{" "}
                  {profile.rating_count === 1 ? "calificación" : "calificaciones"})
                </span>
              </>
            ) : (
              <span className="text-sm text-white/70">Sin calificaciones todavía</span>
            )}
          </div>
        </div>
      </GradientHero>

      <div className="safe-x mx-auto -mt-5 flex max-w-md flex-col gap-4">
        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {profile?.verification_status === "verified" ? (
              <Chip tone="success" icon={<ShieldCheck className="size-3.5" aria-hidden="true" />}>
                Identidad verificada
              </Chip>
            ) : (
              <Chip tone="warning" icon={<Shield className="size-3.5" aria-hidden="true" />}>
                {profile?.verification_status}
              </Chip>
            )}
          </div>
          <Link to="/perfil/editar" className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-700">
            <Pencil className="size-4" aria-hidden="true" />
            Editar perfil
          </Link>
        </Card>

        {!watchlistClear && (
          <Card className="bg-warning-soft">
            <p className="text-sm font-medium text-warning">
              Estamos verificando tu información, te avisaremos. Mientras tanto no puedes publicar ni solicitar
              viajes.
            </p>
          </Card>
        )}

        {profile?.is_admin && (
          <Link to="/admin/alertas">
            <Card className="flex items-center gap-3">
              <Shield className="size-5 text-accent-700" aria-hidden="true" />
              <span className="font-bold text-text-primary">Panel de administración</span>
            </Card>
          </Link>
        )}

        {profile?.is_driver && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">Conductor</h2>
            <Link to="/conductor/vehiculo">
              <Card className="flex items-center gap-3">
                <Car className="size-5 text-accent-700" aria-hidden="true" />
                <span className="font-semibold text-text-primary">Mi vehículo</span>
              </Card>
            </Link>
            <Link to="/conductor/publicar">
              <Card className="flex items-center gap-3">
                <Pencil className="size-5 text-accent-700" aria-hidden="true" />
                <span className="font-semibold text-text-primary">Publicar viaje</span>
              </Card>
            </Link>
            <Link to="/conductor/mis-viajes">
              <Card className="flex items-center gap-3">
                <ClipboardList className="size-5 text-accent-700" aria-hidden="true" />
                <span className="font-semibold text-text-primary">Mis viajes</span>
              </Card>
            </Link>
          </section>
        )}

        {profile?.is_passenger && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-text-secondary">Pasajero</h2>
            <Link to="/pasajero/buscar">
              <Card className="flex items-center gap-3">
                <Search className="size-5 text-accent-700" aria-hidden="true" />
                <span className="font-semibold text-text-primary">Buscar viajes</span>
              </Card>
            </Link>
            <Link to="/pasajero/mis-solicitudes">
              <Card className="flex items-center gap-3">
                <ClipboardList className="size-5 text-accent-700" aria-hidden="true" />
                <span className="font-semibold text-text-primary">Mis solicitudes</span>
              </Card>
            </Link>
          </section>
        )}

        <Button variant="secondary" onClick={() => logoutUser()} className="mt-2">
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
