import { Handler } from "aws-lambda";
import { StepFunctions } from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { CLEAN_ACCOUNT_STATE_MACHINE_ARN } from "../config";
import {
  listReservedAccountsFromDB,
  setAccountAsDirtyInDB,
} from "../db/account";
import { getReservationFromDB } from "../db/reservation";

const sf = new StepFunctions({ region: process.env.AWS_REGION });

export const cleanDanglingAccount: Handler<any, any> = async (
  _event,
  _context
) => {
  console.log("About to clean accounts whose reservation no longer exists");

  const accounts = await listReservedAccountsFromDB();
  await Promise.all(
    accounts
      .filter((a) => a.reservationId !== null)
      .map(async (a) => {
        const r = await getReservationFromDB(a.reservationId);
        if (!r) {
          console.log(
            `Found an account ${a.id} referencing to non-existing reservation ${a.reservationId}`
          );

          return setAccountAsDirtyInDB(a.id).then(() =>
            sf
              .startExecution({
                stateMachineArn: CLEAN_ACCOUNT_STATE_MACHINE_ARN,
                name: uuidv4(),
                input: JSON.stringify({
                  id: a.id,
                }),
              })
              .promise()
          );
        }

        return false;
      })
  );

  return {
    status: true,
  };
};
