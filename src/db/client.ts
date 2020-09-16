import { CLIENT_TABLE } from "../config";
import { Client } from "../model";
import { dynamo } from "./common";

export const getClientFromDB = (id: string): Promise<Client | null> =>
  dynamo
    .get({
      TableName: CLIENT_TABLE,
      Key: { id },
    })
    .promise()
    .then(({ Item }) => {
      if (!Item) {
        return null;
      }

      return {
        id: Item.id,
        password: Item.password,
      };
    });
