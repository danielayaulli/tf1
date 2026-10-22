import { supabase } from "../../lib/supabase";
import { lineStringToWkt, pointToWkt } from "../../lib/geo";
import type { LatLng } from "../../lib/geo";
import type { PickupRequest, PickupRequestStatus, Trip } from "../../types/trip";
import type { PublicProfile } from "../../types/profile";

export interface CreateTripInput {
  driverId: string;
  origin: LatLng;
  destination: LatLng;
  route: LatLng[];
  avenida: string;
  departureTime: string;
  seatsTotal: number;
}

export async function createTrip(input: CreateTripInput) {
  const { error } = await supabase.from("trips").insert({
    driver_id: input.driverId,
    origin: pointToWkt(input.origin),
    destination: pointToWkt(input.destination),
    route_geom: lineStringToWkt(input.route),
    avenida: input.avenida,
    departure_time: input.departureTime,
    seats_total: input.seatsTotal,
    seats_available: input.seatsTotal,
  });
  if (error) throw error;
}

export async function fetchMyTrips(driverId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("id, driver_id, avenida, departure_time, seats_total, seats_available, status, created_at")
    .eq("driver_id", driverId)
    .order("departure_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface PickupRequestWithPassenger extends PickupRequest {
  passenger: PublicProfile | null;
}

export async function fetchRequestsForTrips(
  tripIds: string[],
): Promise<PickupRequestWithPassenger[]> {
  if (tripIds.length === 0) return [];

  const { data: requests, error } = await supabase
    .from("pickup_requests")
    .select("id, trip_id, passenger_id, status, created_at")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  const passengerIds = [...new Set(requests.map((r) => r.passenger_id))];
  const { data: passengers, error: passengersError } = await supabase
    .from("public_profiles")
    .select("id, nombre_pila, foto_url, rating_avg, rating_count")
    .in("id", passengerIds);
  if (passengersError) throw passengersError;

  const passengerById = new Map((passengers ?? []).map((p) => [p.id, p]));
  return requests.map((r) => ({ ...r, passenger: passengerById.get(r.passenger_id) ?? null }));
}

export async function respondToRequest(requestId: string, status: PickupRequestStatus) {
  const { error } = await supabase.from("pickup_requests").update({ status }).eq("id", requestId);
  if (error) throw error;
}

export interface NearbyTrip {
  trip_id: string;
  avenida: string;
  departure_time: string;
  seats_total: number;
  seats_available: number;
  distance_m: number;
  driver_nombre_pila: string;
  driver_rating_avg: number | null;
  driver_rating_count: number;
  men_count: number;
  women_count: number;
}

export async function fetchNearbyTrips(point: LatLng, toleranceM = 150): Promise<NearbyTrip[]> {
  const { data, error } = await supabase.rpc("nearby_trips", {
    passenger_lat: point.lat,
    passenger_lng: point.lng,
    tolerance_m: toleranceM,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTripRoutePoints(tripId: string): Promise<LatLng[]> {
  const { data, error } = await supabase.rpc("trip_route_points", { p_trip_id: tripId });
  if (error) throw error;
  return data ?? [];
}

export interface RequestPickupInput {
  tripId: string;
  passengerId: string;
  pickupPoint: LatLng;
}

export async function requestPickup(input: RequestPickupInput) {
  const { error } = await supabase.from("pickup_requests").insert({
    trip_id: input.tripId,
    passenger_id: input.passengerId,
    pickup_point: pointToWkt(input.pickupPoint),
  });
  if (error) throw error;
}
