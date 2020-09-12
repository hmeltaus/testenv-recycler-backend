import { Handler } from "aws-lambda";
import { FULFILLMENT_ID } from "../../config";
import { persistFulfillmentToDB } from "../../db";

interface EndProcessOutput {
  status: boolean;
}

export const endProcess: Handler<any, EndProcessOutput> = async (
  _event,
  _context
) => {
  await persistFulfillmentToDB({
    id: FULFILLMENT_ID,
    running: false,
  });

  return {
    status: true,
  };
};
