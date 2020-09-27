import { PROCESS_TABLE } from "../config";
import { dynamo } from "./common";

const ID = "fulfillment";

export const lockProcessInDB = async (lock: string): Promise<boolean> => {
  console.log(`Attempt to lock process using lock '${lock}'`);
  return dynamo
    .update({
      TableName: PROCESS_TABLE,
      Key: { id: ID },
      UpdateExpression: "SET #lock = :lock, started = :started",
      ConditionExpression: "attribute_not_exists(#lock)",
      ExpressionAttributeValues: {
        ":lock": lock,
        ":started": Date.now(),
      },
      ExpressionAttributeNames: {
        "#lock": "lock",
      },
      ReturnValues: "ALL_NEW",
    })
    .promise()
    .then((res) => res.Attributes.lock === lock);
};

export const releaseProcessInDB = async (lock: string): Promise<boolean> => {
  console.log(`Release process locked by ${lock}`);
  return dynamo
    .update({
      TableName: PROCESS_TABLE,
      Key: { id: ID },
      UpdateExpression: "REMOVE #lock, started",
      ConditionExpression: "#lock = :lock",
      ExpressionAttributeValues: {
        ":lock": lock,
      },
      ExpressionAttributeNames: {
        "#lock": "lock",
      },
      ReturnValues: "ALL_NEW",
    })
    .promise()
    .then((res) => res.Attributes.lock === undefined);
};
