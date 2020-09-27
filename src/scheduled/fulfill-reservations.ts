import { Handler } from "aws-lambda";
import { StepFunctions } from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { FULFILL_RESERVATIONS_STATE_MACHINE_ARN } from "../config";

const sf = new StepFunctions({ region: process.env.AWS_REGION });

export const fulfillReservations: Handler<any, any> = async (
  _event,
  _context
) => {
  console.log("About to fulfill pending reservations");

  await sf.startExecution({
    stateMachineArn: FULFILL_RESERVATIONS_STATE_MACHINE_ARN,
    name: uuidv4(),
  });

  return {
    status: true,
  };
};
