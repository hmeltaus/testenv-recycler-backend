import { Handler } from "aws-lambda";
import { persistProcessToDB } from "../../db/process";

interface EndProcessOutput {
  status: boolean;
}

export const endProcess: Handler<any, EndProcessOutput> = async (
  _event,
  _context
) => {
  console.log("End process");

  await persistProcessToDB({
    id: "fulfillment",
    running: false,
    started: null,
  });

  return {
    status: true,
  };
};
