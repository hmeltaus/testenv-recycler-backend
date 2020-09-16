import { AttributeMap, Key } from "aws-sdk/clients/dynamodb";
import { RESERVATION_TABLE } from "../config";
import { EnvSlot, Reservation } from "../model";
import { dynamo } from "./common";

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
    data: data ? JSON.stringify(data) : undefined,
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
          data: data || null,
          environmentId: environmentId || null,
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

const listReservationsWithPagingFromDB = async (
  reservationStatus: string,
  collected: AttributeMap[] = [],
  startKey?: Key
): Promise<any[]> =>
  dynamo
    .scan({
      TableName: RESERVATION_TABLE,
      ExclusiveStartKey: startKey,
      ScanFilter: {
        status: {
          AttributeValueList: [reservationStatus],
          ComparisonOperator: "EQ",
        },
      },
    })
    .promise()
    .then(({ Items, LastEvaluatedKey }) => {
      if (!LastEvaluatedKey) {
        return [...collected, ...Items];
      }

      return listReservationsWithPagingFromDB(
        reservationStatus,
        [...collected, ...Items],
        LastEvaluatedKey
      );
    });

export const listReservationsFromDB = async (
  reservationStatus: string
): Promise<Reservation[]> =>
  listReservationsWithPagingFromDB(reservationStatus).then((collected) => {
    const itemsByReservation = new Map<string, any[]>();
    collected.forEach((item) => {
      const reservationId = item.id;
      const reservationItems = itemsByReservation.get(reservationId);
      if (reservationItems) {
        reservationItems.push(item);
      } else {
        itemsByReservation.set(reservationId, [item]);
      }
    });

    const reservations = new Array<Reservation>();
    const reservationIds = itemsByReservation.keys();
    for (const reservationId of reservationIds) {
      const reservationItems = itemsByReservation.get(reservationId);

      const reservation = reservationItems.find(
        (item) => item.slot === "reservation"
      );
      const envs = reservationItems.filter(
        (item) => item.slot !== "reservation"
      );

      reservations.push({
        id: reservation.id,
        status: reservation.status,
        created: parseInt(reservation.created, 10),
        expires: parseInt(reservation.expires, 10),
        type: reservation.type,
        envs: envs.map((slot) => ({
          slot: slot.slot,
          status: slot.status,
          environmentId: slot.environmentId || null,
          data: slot.data || null,
        })),
      });
    }

    return reservations.sort((a, b) => a.created - b.created);
  });

export const listPendingReservationsFromDB = async (): Promise<Reservation[]> =>
  listReservationsFromDB("pending");

export const listExpiredReservationsFromDB = async (): Promise<Reservation[]> =>
  listReservationsFromDB("expired");

export const setReservationAsReadyInDB = async (
  id: string
): Promise<boolean> => {
  console.log(`Set reservation ${id} as ready`);
  return dynamo
    .update({
      TableName: RESERVATION_TABLE,
      Key: {
        id,
        slot: "reservation",
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

export const setReservationAsExpiredInDB = async (
  id: string
): Promise<boolean> => {
  console.log(`Set reservation ${id} as expired`);
  return dynamo
    .update({
      TableName: RESERVATION_TABLE,
      Key: {
        id,
        slot: "reservation",
      },
      AttributeUpdates: {
        status: {
          Value: "expired",
          Action: "PUT",
        },
      },
    })
    .promise()
    .then(() => true);
};

export const setReservationSlotAsExpiredInDB = async (
  id: string,
  slot: string
): Promise<boolean> => {
  console.log(`Set reservation ${id}/${slot} as expired`);
  return dynamo
    .update({
      TableName: RESERVATION_TABLE,
      Key: {
        id,
        slot,
      },
      AttributeUpdates: {
        status: {
          Value: "expired",
          Action: "PUT",
        },
      },
    })
    .promise()
    .then(() => true);
};

export const setReservationSlotAsReadyInDB = async (
  id: string,
  slot: string,
  environmentId: string,
  data: any | null
): Promise<boolean> => {
  console.log(`Set reservation slot ${id}/${slot} as ready`);
  return dynamo
    .update({
      TableName: RESERVATION_TABLE,
      Key: {
        id,
        slot,
      },
      AttributeUpdates: {
        status: {
          Value: "ready",
          Action: "PUT",
        },
        environmentId: {
          Value: environmentId,
          Action: "PUT",
        },
        data: data
          ? {
              Value: JSON.stringify(data),
              Action: "PUT",
            }
          : {
              Action: "DELETE",
            },
      },
    })
    .promise()
    .then(() => true);
};
