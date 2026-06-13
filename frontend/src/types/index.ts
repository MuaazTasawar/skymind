// ─── Drone ────────────────────────────────────────────────────

export type DroneStatus =
  | "idle"
  | "armed"
  | "flying"
  | "fault"
  | "rtl"
  | "landing";

export interface Drone {
  id: string;
  name: string;
  sitl_port: number;
  status: DroneStatus;
  lat: number;
  lng: number;
  alt_m: number;
  roll_deg: number;
  pitch_deg: number;
  yaw_deg: number;
  airspeed_ms: number;
  groundspeed_ms: number;
  heading_deg: number;
  climb_rate_ms: number;
  battery_pct: number;
  battery_volt: number;
  waypoint_index: number;
  waypoint_total: number;
  armed: boolean;
  gps_fix: boolean;
  last_heartbeat: string;
  connected: boolean;
  assigned_zone_id?: string;
  mission_id?: string;
}

// ─── Mission ──────────────────────────────────────────────────

export type MissionStatus =
  | "pending"
  | "planning"
  | "active"
  | "completed"
  | "aborted"
  | "fault";

export interface Waypoint {
  lat: number;
  lng: number;
  alt: number;
}

export interface ZoneAssignment {
  id: string;
  mission_id: string;
  drone_id: string;
  zone_id: string;
  status: string;
  waypoints: Waypoint[];
  created_at: string;
  updated_at: string;
}

export interface Mission {
  id: string;
  name: string;
  created_by: string;
  status: MissionStatus;
  zone_geojson: [number, number][];
  altitude_m: number;
  airspeed_ms: number;
  plan_geojson?: unknown;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MissionDetail extends Mission {
  assignments: ZoneAssignment[];
}

// ─── Auth ─────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  username: string;
  role: string;
}

export interface Operator {
  username: string;
  role: string;
}

// ─── WebSocket messages ───────────────────────────────────────

export type WSEventType =
  | "telemetry"
  | "drone_fault"
  | "zone_reassigned"
  | "mission_complete"
  | "mission_started";

export interface FleetSnapshot {
  timestamp: string;
  drones: Drone[];
}

export interface FaultEvent {
  drone_id: string;
  drone_name: string;
  reason: string;
  at: string;
}

export interface ReassignEvent {
  faulted_drone_id: string;
  replacement_drone_id: string;
  zone_id: string;
  at: string;
}

export interface WSMessage {
  type: WSEventType;
  payload: FleetSnapshot | FaultEvent | ReassignEvent | unknown;
}

// ─── API responses ────────────────────────────────────────────

export interface ApiError {
  error: string;
}

export interface DronesResponse {
  drones: Drone[];
}

export interface MissionsResponse {
  missions: Mission[];
}

export interface MissionResponse {
  mission: MissionDetail;
  assignments: ZoneAssignment[];
}