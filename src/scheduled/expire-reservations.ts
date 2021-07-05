import { Handler } from "aws-lambda";
import {
  listPendingReservationsFromDB,
  setReservationAsExpiredInDB,
} from "../db/reservation";

export const expireReservations: Handler<any, any> = async (
  _event,
  _context
) => {
  console.log("About expire reservations");

  const reservations = await listPendingReservationsFromDB();
  console.log(`Found ${reservations.length} pending reservations`);

  const now = Date.now();
  const expiredReservations = reservations.filter(
    (reservation) => reservation.expires < now
  );
  console.log(
    `Found ${expiredReservations.length} pending reservations whose expired date has been passed`
  );

  await expiredReservations.map(async (reservation) => {
    console.log(`Set reservation ${reservation.id} as expired`);
    await setReservationAsExpiredInDB(reservation.id);
  });

  return {
    status: true,
  };
};
