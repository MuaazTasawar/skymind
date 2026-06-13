import { getToken, clearAuth } from "@/lib/auth";
import type {
  AuthResponse,
  DronesResponse,
  Drone,
  MissionsResponse,
  MissionDetail,
  Mission,
  MissionStatus,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ username, password }) },
    false,
  );
}

// ── Fleet ─────────────────────────────────────────────────────────────────────

export async function fetchDrones(): Promise<Drone[]> {
  const res = await apiFetch<DronesResponse>("/api/drones");
  return res.drones ?? [];
}

export async function fetchDrone(id: string): Promise<Drone> {
  const res = await apiFetch<{ drone: Drone }>(`/api/drones/${id}`);
  return res.drone;
}

// ── Missions ──────────────────────────────────────────────────────────────────

export async function fetchMissions(): Promise<Mission[]> {
  const res = await apiFetch<MissionsResponse>("/api/missions");
  return res.missions ?? [];
}

export async function fetchMission(id: string): Promise<MissionDetail> {
  const res = await apiFetch<{ mission: MissionDetail; assignments: unknown }>(
    `/api/missions/${id}`,
  );
  return res.mission;
}

export async function createMission(payload: {
  name: string;
  zone_geojson: [number, number][];
  altitude_m: number;
  airspeed_ms: number;
}): Promise<Mission> {
  const res = await apiFetch<{ mission: Mission }>(
    "/api/missions",
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.mission;
}

export async function updateMissionStatus(
  id: string,
  status: MissionStatus,
): Promise<Mission> {
  const res = await apiFetch<{ mission: Mission }>(
    `/api/missions/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
  return res.mission;
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/health", {}, false);
}