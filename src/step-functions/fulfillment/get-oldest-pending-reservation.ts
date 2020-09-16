import { Handler } from "aws-lambda";
import { listPendingReservationsFromDB } from "../../db/reservation";
import { Reservation } from "../../model";

interface GetOldestPendingReservationOutput {
  reservation?: Reservation;
}

export const getOldestPendingReservation: Handler<
  any,
  GetOldestPendingReservationOutput
> = async (_event, _context) => {
  console.log("Get oldest pending reservation");

  const reservations = await listPendingReservationsFromDB();
  console.log(`Found ${reservations.length} pending reservations`);
  if (reservations.length === 0) {
    return {};
  }

  return {
    reservation: reservations[0],
  };
};
