import { Handler } from "aws-lambda";
import { FULFILLMENT_ID } from "../../config";
import { persistFulfillmentToDB } from "../../db";

interface StartProcessOutput {
  status: boolean;
}

export const startProcess: Handler<any, StartProcessOutput> = async (
  _event,
  _context
) => {
  await persistFulfillmentToDB({
    id: FULFILLMENT_ID,
    running: true,
  });

  return {
    status: true,
  };
};
