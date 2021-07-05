import { Handler } from "aws-lambda";
import { StepFunctions } from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { CLEAN_ACCOUNT_STATE_MACHINE_ARN } from "../config";
import { setAccountAsDirtyInDB } from "../db/account";
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
      reservation.accounts
        .filter((slot) => slot.accountId !== null)
        .map((slot) => {
          return setAccountAsDirtyInDB(slot.accountId).then(() =>
            sf
              .startExecution({
                stateMachineArn: CLEAN_ACCOUNT_STATE_MACHINE_ARN,
                name: uuidv4(),
                input: JSON.stringify({
                  id: slot.accountId,
                }),
              })
              .promise()
          );
        })
    );
  });

  return {
    status: true,
  };
};
