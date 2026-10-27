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
import "./App.css";

function App() {
  return (
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
