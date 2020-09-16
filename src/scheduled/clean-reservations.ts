import { Handler } from "aws-lambda";
import { StepFunctions } from "aws-sdk";
import { CLEAN_STATE_MACHINE_ARN } from "../config";
import { setEnvironmentAsDirtyInDB } from "../db/environment";
import {
  listExpiredReservationsFromDB,
  removeReservationFromDB,
} from "../db/reservation";

const sf = new StepFunctions({ region: process.env.AWS_REGION });

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
          return setEnvironmentAsDirtyInDB(
            env.environmentId,
            reservation.type
          ).then(() =>
            sf.startExecution({
              stateMachineArn: CLEAN_STATE_MACHINE_ARN,
              name: `${reservation.type}-${env.environmentId}`,
              input: JSON.stringify({
                id: env.environmentId,
                type: reservation.type,
              }),
            })
          );
        })
    );
  });

  return {
    status: true,
  };
};
