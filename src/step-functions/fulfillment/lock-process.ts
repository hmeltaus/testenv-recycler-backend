import { Handler } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { lockProcessInDB } from "../../db/process";

interface LockProcessOutput {
  lock?: string;
}

export const lockProcess: Handler<any, LockProcessOutput> = async (
  _event,
  _context
) => {
  const lock = uuidv4();
  console.log(`Lock process using lock ${lock}`);

  if (await lockProcessInDB(lock)) {
    return { lock };
  } else {
    return {};
  }
};
