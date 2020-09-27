import { Handler } from "aws-lambda";
import { releaseProcessInDB } from "../../db/process";

interface EndProcessInput {
  lock: string;
}

interface EndProcessOutput {
  lock: string;
}

export const endProcess: Handler<EndProcessInput, EndProcessOutput> = async (
  { lock },
  _context
) => {
  console.log(`End process with lock ${lock}`);

  await releaseProcessInDB(lock);

  return {
    lock,
  };
};
