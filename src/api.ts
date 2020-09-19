import { APIGatewayProxyHandler } from "aws-lambda";
import { StepFunctions } from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { CLEAN_STATE_MACHINE_ARN, FULFILL_STATE_MACHINE_ARN } from "./config";
import { setEnvironmentAsDirtyInDB } from "./db/environment";
import {
  getReservationFromDB,
  persistReservationToDB,
  removeReservationFromDB,
} from "./db/reservation";
import { EnvSlot, Reservation } from "./model";

export interface CreateReservationBody {
  count?: number;
  type?: string;
}

const sf = new StepFunctions({ region: process.env.AWS_REGION });

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
      data: null,
    });
  }

  return envs;
};

export const create: APIGatewayProxyHandler = async (event, _context) => {
  const { type, count } = parseCreateReservationBody(event.body);

  if (!type) {
    throw new Error(`type is required`);
  }

  if (!count) {
    throw new Error(`count is required`);
  }

  if (type !== "aws-account") {
    throw new Error(`type '${type}' is not supported`);
  }

  const id = uuidv4();
  const created = Date.now();
  const expires = created + 1000 * 60 * 5; // 5 mins

  const status = "pending";
  const envs = createEnvSlots(type, count);

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
    await sf
      .startExecution({ stateMachineArn: FULFILL_STATE_MACHINE_ARN })
      .promise();

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
      reservation.envs
        .filter((env) => env.environmentId !== null)
        .map((env) =>
          setEnvironmentAsDirtyInDB(env.environmentId, reservation.type).then(
            () =>
              sf
                .startExecution({
                  stateMachineArn: CLEAN_STATE_MACHINE_ARN,
                  name: uuidv4(),
                  input: JSON.stringify({
                    id: env.environmentId,
                    type: reservation.type,
                  }),
                })
                .promise()
          )
        )
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
