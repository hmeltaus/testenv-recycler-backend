import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import {
  getReservationFromDB,
  persistReservationToDB,
  removeReservationFromDB,
  setEnvironmentAsDirtyInDB,
} from "./db";
import { EnvSlot, Reservation } from "./model";

export interface CreateReservationBody {
  count: number;
}

const parseCreateReservationBody = (json: string): CreateReservationBody =>
  JSON.parse(json) as CreateReservationBody;

const createEnvSlots = (type: string, count: number): EnvSlot[] => {
  const envs = new Array<EnvSlot>();
  const status = "pending";
  for (let index = 0; index < count; index++) {
    envs.push({
      status,
      environmentId: null,
      slot: `slot-${index}`,
      data: {},
    });
  }

  return envs;
};

export const create: APIGatewayProxyHandler = async (event, _context) => {
  const body = parseCreateReservationBody(event.body);

  const id = uuidv4();
  const created = Date.now();
  const expires = created + 1000 * 60 * 5;
  const type = "aws-account";
  const status = "pending";
  const envs = createEnvSlots(type, body.count);

  const reservation: Reservation = {
    id,
    type,
    created,
    expires,
    status,
    envs,
  };

  try {
    await persistReservationToDB(reservation);
    return {
      statusCode: 200,
      body: JSON.stringify(reservation, null, 2),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: e.message,
      }),
    };
  }
};

export const get: APIGatewayProxyHandler = async (event, _context) => {
  try {
    const reservation = await getReservationFromDB(event.pathParameters.id);
    if (reservation) {
      return {
        statusCode: 200,
        body: JSON.stringify(reservation, null, 2),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Not found" }, null, 2),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: e.message,
      }),
    };
  }
};

export const remove: APIGatewayProxyHandler = async (event, _context) => {
  console.log(
    `About to remove a reservation with id ${event.pathParameters.id}`
  );

  try {
    const reservation = await removeReservationFromDB(event.pathParameters.id);
    if (!reservation) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not found" }, null, 2),
      };
    }

    console.log(`Reservation removed successfully`);

    await Promise.all(
      reservation.envs.map((env) => {
        setEnvironmentAsDirtyInDB(reservation.type, env.environmentId);
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(reservation, null, 2),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: e.message,
      }),
    };
  }
};
