import { Key } from "aws-sdk/clients/dynamodb";
import { ENVIRONMENT_TABLE } from "../config";
import { Environment } from "../model";
import { dynamo } from "./common";

export const getEnvironmentFromDB = (
  id: string,
  type: string
): Promise<Environment | null> =>
  dynamo
    .get({
      TableName: ENVIRONMENT_TABLE,
      Key: { id, type },
    })
    .promise()
    .then(({ Item }) => {
      if (!Item) {
        return null;
      }

      return {
        id: Item.id,
        type: Item.type,
        status: Item.status,
        reservationId: Item.reservationId || null,
        data: Item.data || null,
      };
    });

export const setEnvironmentAsDirtyInDB = async (
  id: string,
  type: string
): Promise<boolean> => {
  console.log(`Set environment as dirty type: ${type}, id: ${id}`);
  return dynamo
    .update({
      TableName: ENVIRONMENT_TABLE,
      Key: {
        type,
        id,
      },
      AttributeUpdates: {
        status: {
          Value: "dirty",
          Action: "PUT",
        },
        reservationId: {
          Action: "DELETE",
        },
      },
    })
    .promise()
    .then(() => true);
};

export const setEnvironmentAsReadyInDB = async (
  id: string,
  type: string
): Promise<boolean> => {
  console.log(`Set environment as ready type: ${type}, id: ${id}`);
  return dynamo
    .update({
      TableName: ENVIRONMENT_TABLE,
      Key: {
        type,
        id,
      },
      AttributeUpdates: {
        status: {
          Value: "ready",
          Action: "PUT",
        },
      },
    })
    .promise()
    .then(() => true);
};

export const setEnvironmentAsReservedInDB = async (
  id: string,
  type: string,
  reservationId: string
): Promise<boolean> => {
  console.log(`Set environment as reserved type: ${type}, id: ${id}`);
  return dynamo
    .update({
      TableName: ENVIRONMENT_TABLE,
      Key: {
        type,
        id,
      },
      AttributeUpdates: {
        status: {
          Value: "reserved",
          Action: "PUT",
        },
        reservationId: {
          Value: reservationId,
          Action: "PUT",
        },
      },
    })
    .promise()
    .then(() => true);
};

const listReadyEnvironmentsByTypeWithPagingFromDB = async (
  type: string,
  collected: any[],
  startKey?: Key
): Promise<any[]> =>
  dynamo
    .scan({
      TableName: ENVIRONMENT_TABLE,
      ExclusiveStartKey: startKey,
      ScanFilter: {
        type: {
          AttributeValueList: [type],
          ComparisonOperator: "EQ",
        },
        status: {
          AttributeValueList: ["ready"],
          ComparisonOperator: "EQ",
        },
      },
    })
    .promise()
    .then(({ Items, LastEvaluatedKey }) => {
      console.log(
        `Scan returned ${Items.length} items, last evaluated key is ${LastEvaluatedKey}`
      );
      if (!LastEvaluatedKey) {
        return [...collected, ...Items];
      }

      return listReadyEnvironmentsByTypeWithPagingFromDB(
        type,
        [...collected, ...Items],
        LastEvaluatedKey
      );
    });

export const listReadyEnvironmentsByTypeFromDB = async (
  type: string
): Promise<Environment[]> =>
  listReadyEnvironmentsByTypeWithPagingFromDB(type, []).then((collected) =>
    collected.map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      reservationId: item.reservationId || null,
      data: item.data || null,
    }))
  );
