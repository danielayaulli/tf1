import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <p>Cargando...</p>;
  if (!session) return <Navigate to="/login" replace />;

  if (!profile || profile.verification_status === "pending") {
    return <p>Verificando tu identidad, espera un momento...</p>;
  }

  if (profile.verification_status === "rejected") {
    return (
      <p>
        No pudimos verificar tu identidad (DNI inválido o antecedentes
        encontrados). Contacta al administrador.
      </p>
    );
  }

  return <>{children}</>;
}
