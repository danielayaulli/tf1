export type Sexo = "M" | "F";
export type VerificationStatus = "pending" | "verified" | "rejected";

export interface Profile {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  sexo: Sexo;
  is_passenger: boolean;
  is_driver: boolean;
  verification_status: VerificationStatus;
  foto_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  id: string;
  nombre_pila: string;
  foto_url: string | null;
  rating_avg: number | null;
  rating_count: number;
}
