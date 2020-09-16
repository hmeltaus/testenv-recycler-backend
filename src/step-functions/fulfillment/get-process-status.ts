import { Handler } from "aws-lambda";
import { getProcessFromDB } from "../../db/process";

interface GetProcessStatusOutput {
  running: boolean;
}

export const getProcessStatus: Handler<any, GetProcessStatusOutput> = async (
  _event,
  _context
) => {
  console.log("Get process status");

  const fulfillment = await getProcessFromDB("fulfillment");
  const running = fulfillment ? fulfillment.running : false;

  return {
    running,
  };
};
