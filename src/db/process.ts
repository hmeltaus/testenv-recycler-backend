import { PROCESS_TABLE } from "../config";
import { Process } from "../model";
import { dynamo } from "./common";

export const getProcessFromDB = (id: string): Promise<Process | null> =>
  dynamo
    .get({
      TableName: PROCESS_TABLE,
      Key: { id },
    })
    .promise()
    .then(({ Item }) => {
      if (!Item) {
        return null;
      }

      return {
        id: Item.id,
        running: Item.running,
        started: Item.started || null,
      };
    });

export const persistProcessToDB = async ({
  id,
  running,
  started,
}: Process): Promise<boolean> =>
  dynamo
    .put({
      TableName: PROCESS_TABLE,
      Item: {
        id,
        running,
        started: started || undefined,
      },
    })
    .promise()
    .then(() => true);
