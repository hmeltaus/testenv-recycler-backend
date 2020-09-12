export interface EnvSlot {
  slot: string;
  environmentId: string | null;
  status: "pending" | "ready" | "failed";
  data: any;
}

export interface Reservation {
  id: string;
  type: string;
  created: number;
  expires: number;
  status: "pending" | "ready" | "failed";
  envs: EnvSlot[];
}

export interface Client {
  id: string;
  password: string;
}

export interface Environment {
  id: string;
  type: string;
  status: "ready" | "reserved" | "dirty" | "cleaning";
  reservationId: string | null;
  data: any;
}

export interface Fulfillment {
  id: string;
  running: boolean;
}
