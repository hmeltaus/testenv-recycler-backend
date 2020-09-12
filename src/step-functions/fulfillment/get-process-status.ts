import { Handler } from "aws-lambda";
import { FULFILLMENT_ID } from "../../config";
import { getFulfillmentFromDB } from "../../db";

interface GetProcessStatusOutput {
  running: boolean;
}

export const getProcessStatus: Handler<any, GetProcessStatusOutput> = async (
  _event,
  _context
) => {
  const fulfillment = await getFulfillmentFromDB(FULFILLMENT_ID);
  const running = fulfillment ? fulfillment.running : false;

  return {
    running,
  };
};
