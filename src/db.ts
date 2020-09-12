import { DynamoDB } from "aws-sdk";
import {
  CLIENT_TABLE,
  ENVIRONMENT_TABLE,
  FULFILLMENT_TABLE,
  RESERVATION_TABLE,
} from "./config";
import { Client, EnvSlot, Fulfillment, Reservation } from "./model";

const dynamo = new DynamoDB.DocumentClient({ region: "eu-west-1" });

export interface ReservationDBItem {
  id: string;
  slot: string;
  type: string;
  created: number;
  expires: number;
  status: string;
}

export interface EnvSlotDBItem {
  id: string;
  slot: string;
  status: string;
  data: string;
  environmentId?: string;
}

export type ReservationTableItem = ReservationDBItem | EnvSlotDBItem;

const convertToReservationDbItem = ({
  id,
  status,
  created,
  expires,
  type,
}: Reservation): ReservationDBItem => ({
  id,
  status,
  created,
  expires,
  type,
  slot: "reservation",
});

const convertToEnvSlotDBItem = (
  reservationId: string,
  { data, slot, status, environmentId }: EnvSlot
): EnvSlotDBItem => {
  const item = {
    id: reservationId,
    slot,
    status,
    data: JSON.stringify(data),
  };

  if (!environmentId) {
    return item;
  }

  return {
    ...item,
    environmentId,
  };
};

export const persistReservationToDB = async (
  reservation: Reservation
): Promise<boolean> => {
  const items: ReservationTableItem[] = [
    convertToReservationDbItem(reservation),
    ...reservation.envs.map((env) =>
      convertToEnvSlotDBItem(reservation.id, env)
    ),
  ];

  const putRequests = items.map((item) => ({ PutRequest: { Item: item } }));

  return dynamo
    .batchWrite({
      RequestItems: {
        [RESERVATION_TABLE]: putRequests,
      },
    })
    .promise()
    .then(() => true);
};

export const getReservationFromDB = async (
  id: string
): Promise<Reservation | null> =>
  dynamo
    .query({
      TableName: RESERVATION_TABLE,
      ConsistentRead: true,
      KeyConditions: {
        id: { ComparisonOperator: "EQ", AttributeValueList: [id] },
      },
    })
    .promise()
    .then(({ Items, Count }) => {
      if (Count === 0) {
        return null;
      }

      const reservation = Items.find((item) => item.slot === "reservation");
      const envs = Items.filter((item) => item.slot !== "reservation");

      return {
        id: reservation.id,
        status: reservation.status,
        created: reservation.created,
        expires: reservation.expires,
        type: reservation.type,
        slot: "reservation",
        envs: envs.map(({ slot, status, data, environmentId }) => ({
          slot,
          status,
          environmentId: environmentId || null,
          data: JSON.parse(data),
        })),
      };
    });

export const removeReservationFromDB = async (
  id: string
): Promise<Reservation | null> => {
  const reservation = await getReservationFromDB(id);
  if (!reservation) {
    return null;
  }

  const requests = [
    { id: reservation.id, slot: "reservation" },
    ...reservation.envs.map((r) => ({
      id: reservation.id,
      slot: r.slot,
    })),
  ].map((item) => ({
    DeleteRequest: {
      Key: item,
    },
  }));

  return dynamo
    .batchWrite({
      RequestItems: {
        [RESERVATION_TABLE]: requests,
      },
    })
    .promise()
    .then(() => reservation);
};

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

export const setEnvironmentAsDirtyInDB = async (
  type: string,
  id: string
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

export const getFulfillmentFromDB = (id: string): Promise<Fulfillment | null> =>
  dynamo
    .get({
      TableName: FULFILLMENT_TABLE,
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
      };
    });

export const persistFulfillmentToDB = async ({
  id,
  running,
}: Fulfillment): Promise<boolean> =>
  dynamo
    .put({
      TableName: FULFILLMENT_TABLE,
      Item: {
        id,
        running,
      },
    })
    .promise()
    .then(() => true);
