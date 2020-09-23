export interface AccountSlot {
  slot: string;
  accountId: string | null;
  status: "pending" | "ready" | "failed" | string;
}

export interface ReservationCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface Reservation {
  id: string;
  name: string;
  created: number;
  expires: number;
  status: "pending" | "ready" | "failed" | "expired" | string;
  accounts: AccountSlot[];
}

export interface ReservationWithCredentials extends Reservation {
  credentials: ReservationCredentials | null;
}

export interface User {
  username: string;
  password: string;
}

export interface Account {
  id: string;
  status: "ready" | "reserved" | "dirty" | "cleaning" | string;
  reservationId: string | null;
  managementRoleArn: string;
}

export interface Process {
  id: string;
  running: boolean;
  started: number | null;
}
