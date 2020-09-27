import { Handler } from "aws-lambda";
import { listPendingReservationsFromDB } from "../../db/reservation";
import { Reservation } from "../../model";

interface GetOldestPendingReservationInput {
  lock: string;
}

interface GetOldestPendingReservationOutput {
  reservation?: Reservation;
  lock: string;
}

export const getOldestPendingReservation: Handler<
  GetOldestPendingReservationInput,
  GetOldestPendingReservationOutput
> = async ({ lock }, _context) => {
  console.log("Get oldest pending reservation");

  const reservations = await listPendingReservationsFromDB();
  console.log(`Found ${reservations.length} pending reservations`);
  if (reservations.length === 0) {
    return {
      lock,
    };
  }

  return {
    lock,
    reservation: reservations[0],
  };
};
