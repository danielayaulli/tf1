import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "./api";
import { isValidDni } from "./validation";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dni, setDni] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [isPassenger, setIsPassenger] = useState(true);
  const [isDriver, setIsDriver] = useState(false);
  const [acceptsPrivacy, setAcceptsPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidDni(dni)) {
      setError("El DNI debe tener exactamente 8 dígitos.");
      return;
    }
    if (!isPassenger && !isDriver) {
      setError("Elige al menos un rol: pasajero o conductor.");
      return;
    }
    if (!acceptsPrivacy) {
      setError("Debes aceptar el tratamiento de tus datos personales para registrarte.");
      return;
    }

    setSubmitting(true);
    try {
      await registerUser({
        email,
        password,
        dni,
        nombres,
        apellidos,
        sexo,
        isPassenger,
        isDriver,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Crear cuenta</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          DNI
          <input
            type="text"
            required
            inputMode="numeric"
            maxLength={8}
            value={dni}
            onChange={(e) => setDni(e.target.value)}
          />
        </label>
        <label>
          Nombres
          <input required value={nombres} onChange={(e) => setNombres(e.target.value)} />
        </label>
        <label>
          Apellidos
          <input required value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
        </label>
        <fieldset>
          <legend>Sexo</legend>
          <label>
            <input type="radio" name="sexo" checked={sexo === "M"} onChange={() => setSexo("M")} />
            Masculino
          </label>
          <label>
            <input type="radio" name="sexo" checked={sexo === "F"} onChange={() => setSexo("F")} />
            Femenino
          </label>
        </fieldset>
        <fieldset>
          <legend>Rol (puedes elegir ambos)</legend>
          <label>
            <input
              type="checkbox"
              checked={isPassenger}
              onChange={(e) => setIsPassenger(e.target.checked)}
            />
            Pasajero
          </label>
          <label>
            <input
              type="checkbox"
              checked={isDriver}
              onChange={(e) => setIsDriver(e.target.checked)}
            />
            Conductor
          </label>
        </fieldset>

        <fieldset>
          <legend>Privacidad</legend>
          <p>
            Usamos tu DNI y nombres solo para verificar tu identidad (incluida una comparación contra
            registros públicos) y coordinar tus viajes. Nunca se muestran a otros usuarios. Puedes pedir que
            se eliminen escribiéndonos.
          </p>
          <label>
            <input
              type="checkbox"
              checked={acceptsPrivacy}
              onChange={(e) => setAcceptsPrivacy(e.target.checked)}
            />
            Acepto el tratamiento de mis datos personales conforme a la Ley N° 29733 (Ley de Protección de
            Datos Personales).
          </label>
        </fieldset>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Creando cuenta..." : "Registrarme"}
        </button>
      </form>
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </div>
  );
}
