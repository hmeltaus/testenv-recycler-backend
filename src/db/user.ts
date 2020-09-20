import { USER_TABLE } from "../config";
import { User } from "../model";
import { dynamo } from "./common";

export const getUserFromDB = (username: string): Promise<User | null> =>
  dynamo
    .get({
      TableName: USER_TABLE,
      Key: { username },
    })
    .promise()
    .then(({ Item }) => {
      if (!Item) {
        return null;
      }

      return {
        username: Item.username,
        password: Item.password,
      };
    });
