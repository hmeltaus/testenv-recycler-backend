import { Handler } from "aws-lambda";
import { setEnvironmentAsDirtyInDB } from "../db/environment";
import {
  listExpiredReservationsFromDB,
  removeReservationFromDB,
} from "../db/reservation";

export const cleanReservations: Handler<any, any> = async (
  _event,
  _context
) => {
  console.log("About to clean expired reservations");

  const reservations = await listExpiredReservationsFromDB();
  console.log(`Found ${reservations.length} expired reservations`);

  await reservations.map(async (reservation) => {
    console.log(`Remove reservation ${reservation.id}`);
    await removeReservationFromDB(reservation.id);

    await Promise.all(
      reservation.envs
        .filter((env) => env.environmentId !== null)
        .map((env) => {
          console.log(`Mark environment ${env.environmentId} as dirty`);
          return setEnvironmentAsDirtyInDB(env.environmentId, reservation.type);
        })
    );
  });

  return {
    status: true,
  };
};
