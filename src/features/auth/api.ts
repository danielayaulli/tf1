import { supabase } from "../../lib/supabase";
import type { Profile, Sexo } from "../../types/profile";

export interface RegisterInput {
  email: string;
  password: string;
  dni: string;
  nombres: string;
  apellidos: string;
  sexo: Sexo;
  isPassenger: boolean;
  isDriver: boolean;
}

export async function registerUser(input: RegisterInput) {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        dni: input.dni,
        nombres: input.nombres,
        apellidos: input.apellidos,
        sexo: input.sexo,
        is_passenger: input.isPassenger,
        is_driver: input.isDriver,
      },
    },
  });
  if (error) throw error;
}

export async function loginUser(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface VerificationResult {
  status: "verified" | "rejected";
  reason: "dni_not_found" | "criminal_record_found" | null;
}

export async function triggerIdentityVerification(): Promise<VerificationResult> {
  const { data, error } = await supabase.functions.invoke<VerificationResult>(
    "verify-identity",
  );
  if (error) throw error;
  return data as VerificationResult;
}
