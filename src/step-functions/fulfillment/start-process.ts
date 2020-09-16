import { Handler } from "aws-lambda";
import { persistProcessToDB } from "../../db/process";

interface StartProcessOutput {
  status: boolean;
}

export const startProcess: Handler<any, StartProcessOutput> = async (
  _event,
  _context
) => {
  console.log("Start process");

  await persistProcessToDB({
    id: "fulfillment",
    running: true,
    started: Date.now(),
  });

  return {
    status: true,
  };
};
