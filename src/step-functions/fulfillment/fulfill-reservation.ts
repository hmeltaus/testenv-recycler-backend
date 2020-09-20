import { Handler } from "aws-lambda";
import {
  listReadyAccountsFromDB,
  setAccountAsReservedInDB,
} from "../../db/account";
import {
  setReservationAsExpiredInDB,
  setReservationAsReadyInDB,
  setReservationSlotAsExpiredInDB,
  setReservationSlotAsReadyInDB,
} from "../../db/reservation";
import { Reservation } from "../../model";

const MAX_RESERVATION_AGE = 1000 * 60 * 60; // 1 hour

interface FulfillReservationOutput {
  ready: boolean;
}

interface FulfillReservationInput {
  reservation: Reservation;
}

export const fulfillReservation: Handler<
  FulfillReservationInput,
  FulfillReservationOutput
> = async ({ reservation }: FulfillReservationInput, _context) => {
  const now = Date.now();
  if (
    now > reservation.expires ||
    now > reservation.created + MAX_RESERVATION_AGE
  ) {
    console.log(`Reservation ${reservation.id} has expired`);
    await setReservationAsExpiredInDB(reservation.id);
    await Promise.all(
      reservation.accounts.map((account) =>
        setReservationSlotAsExpiredInDB(reservation.id, account.slot)
      )
    );

    return {
      ready: true,
    };
  }

  const pendingSlots = reservation.accounts.filter(
    (s) => s.status === "pending"
  );
  console.log(
    `Reservation ${reservation.id} has ${pendingSlots.length} pending slots`
  );

  if (pendingSlots.length === 0) {
    await setReservationAsReadyInDB(reservation.id);
    return {
      ready: true,
    };
  }

  const readyEnvironments = await listReadyAccountsFromDB();
  console.log(`Found ${readyEnvironments.length} ready accounts`);

  if (readyEnvironments.length === 0) {
    return {
      ready: false,
    };
  }

  const count = Math.min(pendingSlots.length, readyEnvironments.length);
  for (let i = 0; i < count; i++) {
    const slot = pendingSlots[i];
    const environment = readyEnvironments[i];
    console.log(`Assign environment ${environment.id} to slot ${slot.slot}`);
    await setAccountAsReservedInDB(environment.id, reservation.id);
    await setReservationSlotAsReadyInDB(
      reservation.id,
      slot.slot,
      environment.id
    );
  }

  if (count === pendingSlots.length) {
    console.log(`Reservation ${reservation.id} is now ready`);
    await setReservationAsReadyInDB(reservation.id);
    return {
      ready: true,
    };
  }

  console.log(`Reservation ${reservation.id} was not fulfilled`);
  return {
    ready: false,
  };
};
