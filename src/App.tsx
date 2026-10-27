import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { HomePage } from "./features/auth/HomePage";
import { LoginPage } from "./features/auth/LoginPage";
import { AdminRoute } from "./features/auth/AdminRoute";
import { EditProfilePage } from "./features/auth/EditProfilePage";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { RegisterPage } from "./features/auth/RegisterPage";
import { MyTripsPage } from "./features/trips/MyTripsPage";
import { PublishTripPage } from "./features/trips/PublishTripPage";
import { SearchTripsPage } from "./features/trips/SearchTripsPage";
import { MyRequestsPage } from "./features/ratings/MyRequestsPage";
import { VehicleFormPage } from "./features/vehicles/VehicleFormPage";
import { AdminAlertsPage } from "./features/admin/AdminAlertsPage";
import { DesignSystemPage } from "./features/design-system/DesignSystemPage";
import { ToastProvider } from "./components/ui";
import "./App.css";

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil/editar"
              element={
                <ProtectedRoute>
                  <EditProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/alertas"
              element={
                <AdminRoute>
                  <AdminAlertsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/conductor/vehiculo"
              element={
                <ProtectedRoute>
                  <VehicleFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/publicar"
              element={
                <ProtectedRoute>
                  <PublishTripPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/mis-viajes"
              element={
                <ProtectedRoute>
                  <MyTripsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pasajero/buscar"
              element={
                <ProtectedRoute>
                  <SearchTripsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pasajero/mis-solicitudes"
              element={
                <ProtectedRoute>
                  <MyRequestsPage />
                </ProtectedRoute>
              }
            />
            {/* Solo en desarrollo: import.meta.env.DEV es false en el build de
                producción (npm run build), así que esta ruta nunca queda
                alcanzable en Vercel. */}
            {import.meta.env.DEV && <Route path="/design-system" element={<DesignSystemPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
