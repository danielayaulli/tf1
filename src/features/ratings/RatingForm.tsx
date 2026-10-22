import { useState } from "react";
import { submitRating } from "./api";

interface RatingFormProps {
  tripId: string;
  raterId: string;
  ratedId: string;
  ratedName: string;
  onSubmitted: () => void;
}

export function RatingForm({ tripId, raterId, ratedId, ratedName, onSubmitted }: RatingFormProps) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitRating({ tripId, raterId, ratedId, stars, comment: comment.trim() || null });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la calificación.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p>Califica a {ratedName}:</p>
      {error && <p className="error">{error}</p>}
      <label>
        Estrellas
        <select value={stars} onChange={(e) => setStars(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} ({n})
            </option>
          ))}
        </select>
      </label>
      <label>
        Comentario (opcional)
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando..." : "Enviar calificación"}
      </button>
    </form>
  );
}
