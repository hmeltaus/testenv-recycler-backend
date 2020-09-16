export interface EnvSlot {
  slot: string;
  environmentId: string | null;
  status: "pending" | "ready" | "failed" | string;
  data: any | null;
}

export interface Reservation {
  id: string;
  type: string;
  created: number;
  expires: number;
  status: "pending" | "ready" | "failed" | "expired" | string;
  envs: EnvSlot[];
}

export interface Client {
  id: string;
  password: string;
}

export interface Environment {
  id: string;
  type: string;
  status: "ready" | "reserved" | "dirty" | "cleaning" | string;
  reservationId: string | null;
  data: any | null;
}

export interface Process {
  id: string;
  running: boolean;
  started: number | null;
}
