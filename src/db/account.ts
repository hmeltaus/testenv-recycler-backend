import { Key } from "aws-sdk/clients/dynamodb";
import { ACCOUNT_TABLE } from "../config";
import { Account } from "../model";
import { dynamo } from "./common";

export const getAccountFromDB = (id: string): Promise<Account | null> =>
  dynamo
    .get({
      TableName: ACCOUNT_TABLE,
      Key: { id },
    })
    .promise()
    .then(({ Item }) => {
      if (!Item) {
        return null;
      }

      return {
        id: Item.id,
        status: Item.status,
        reservationId: Item.reservationId || null,
        managementRoleArn: Item.managementRoleArn,
      };
    });

export const setAccountAsDirtyInDB = async (id: string): Promise<boolean> => {
  return dynamo
    .update({
      TableName: ACCOUNT_TABLE,
      Key: {
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

export const setAccountAsReadyInDB = async (id: string): Promise<boolean> => {
  return dynamo
    .update({
      TableName: ACCOUNT_TABLE,
      Key: {
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

export const setAccountAsReservedInDB = async (
  id: string,
  reservationId: string
): Promise<boolean> => {
  return dynamo
    .update({
      TableName: ACCOUNT_TABLE,
      Key: {
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

const listAccountsByStatusWithPagingFromDB = async (
  collected: any[],
  status: string,
  startKey?: Key
): Promise<any[]> =>
  dynamo
    .scan({
      TableName: ACCOUNT_TABLE,
      ExclusiveStartKey: startKey,
      ScanFilter: {
        status: {
          AttributeValueList: [status],
          ComparisonOperator: "EQ",
        },
      },
    })
    .promise()
    .then(({ Items, LastEvaluatedKey }) => {
      if (!LastEvaluatedKey) {
        return [...collected, ...Items];
      }

      return listAccountsByStatusWithPagingFromDB(
        [...collected, ...Items],
        status,
        LastEvaluatedKey
      );
    });

export const listReadyAccountsFromDB = async (): Promise<Account[]> =>
  listAccountsByStatusWithPagingFromDB([], "ready").then((collected) =>
    collected.map((item) => ({
      id: item.id,
      status: item.status,
      reservationId: item.reservationId || null,
      managementRoleArn: item.managementRoleArn,
    }))
  );

export const listReservedAccountsFromDB = async (): Promise<Account[]> =>
  listAccountsByStatusWithPagingFromDB([], "reserved").then((collected) =>
    collected.map((item) => ({
      id: item.id,
      status: item.status,
      reservationId: item.reservationId || null,
      managementRoleArn: item.managementRoleArn,
    }))
  );

export const listDirtyAccountsFromDB = async (): Promise<Account[]> =>
  listAccountsByStatusWithPagingFromDB([], "dirty").then((collected) =>
    collected.map((item) => ({
      id: item.id,
      status: item.status,
      reservationId: item.reservationId || null,
      managementRoleArn: item.managementRoleArn,
    }))
  );
