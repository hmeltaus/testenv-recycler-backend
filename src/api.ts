import { APIGatewayProxyHandler } from "aws-lambda";
import { StepFunctions, STS } from "aws-sdk";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { encodeSession, getJwtSecret } from "./auth";
import {
  CLEAN_ACCOUNT_STATE_MACHINE_ARN,
  EXECUTION_ROLE_ARN,
  FULFILL_RESERVATIONS_STATE_MACHINE_ARN,
} from "./config";
import { listDirtyAccountsFromDB, setAccountAsDirtyInDB } from "./db/account";
import {
  getReservationFromDB,
  persistReservationToDB,
  removeReservationFromDB,
} from "./db/reservation";
import { getUserFromDB } from "./db/user";
import { AccountSlot, Reservation } from "./model";
import { randomInt, sleep } from "./util";

export interface CreateReservationBody {
  count?: number;
  name?: string;
}

const sf = new StepFunctions({ region: process.env.AWS_REGION });
const sts = new STS();

const parseCreateReservationBody = (json: string): CreateReservationBody =>
  JSON.parse(json) as CreateReservationBody;

const createAccountSlots = (count: number): AccountSlot[] => {
  const accounts = new Array<AccountSlot>();
  const status = "pending";
  for (let index = 0; index < count; index++) {
    accounts.push({
      status,
      accountId: null,
      slot: `slot-${index}`,
    });
  }

  return accounts;
};

export const create: APIGatewayProxyHandler = async (event, _context) => {
  const { count, name } = parseCreateReservationBody(event.body);

  if (!count) {
    throw new Error(`count is required`);
  }

  if (!name) {
    throw new Error(`name is required`);
  }

  await sleep(randomInt(10, 2000));

  const id = uuidv4();
  const created = Date.now();
  const expires = created + 1000 * 60 * 5; // 5 mins

  const status = "pending";
  const accounts = createAccountSlots(count);

  const reservation: Reservation = {
    id,
    name,
    created,
    expires,
    status,
    accounts,
  };

  try {
    await persistReservationToDB(reservation);
    await sf
      .startExecution({
        stateMachineArn: FULFILL_RESERVATIONS_STATE_MACHINE_ARN,
      })
      .promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ ...reservation, credentials: null }),
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
      if (reservation.status === "ready") {
        const {
          Credentials: { AccessKeyId, SecretAccessKey, SessionToken },
        } = await sts
          .assumeRole({
            DurationSeconds: 3600,
            RoleArn: EXECUTION_ROLE_ARN,
            RoleSessionName: "testenv-recycler",
          })
          .promise();

        const credentials = {
          accessKeyId: AccessKeyId,
          secretAccessKey: SecretAccessKey,
          sessionToken: SessionToken,
        };

        return {
          statusCode: 200,
          body: JSON.stringify({ ...reservation, credentials }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ...reservation, credentials: null }),
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
      reservation.accounts
        .filter((slot) => slot.accountId !== null)
        .map((slot) =>
          setAccountAsDirtyInDB(slot.accountId).then(() =>
            sf
              .startExecution({
                stateMachineArn: CLEAN_ACCOUNT_STATE_MACHINE_ARN,
                name: uuidv4(),
                input: JSON.stringify({
                  id: slot.accountId,
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

export const login: APIGatewayProxyHandler = async (event, _context) => {
  const { username, password } = JSON.parse(event.body);
  if (!username || !password) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        message: "Unauthenticated",
      }),
    };
  }

  const user = await getUserFromDB(username);
  if (!user) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        message: "Unauthenticated",
      }),
    };
  }

  if (!bcrypt.compare(password, user.password)) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        message: "Unauthenticated",
      }),
    };
  }

  const secret = await getJwtSecret();

  return {
    statusCode: 200,
    body: JSON.stringify(
      encodeSession(secret, {
        dateCreated: Date.now(),
        username: user.username,
      })
    ),
  };
};

export const cleanAllDirtyAccounts: APIGatewayProxyHandler = async (
  _event,
  _context
) => {
  const sf = new StepFunctions({ region: process.env.AWS_REGION });

  try {
    const accounts = await listDirtyAccountsFromDB();
    console.log(`Found ${accounts.length} dirty accounts`);
    for (const account of accounts) {
      console.log(
        `Start state machine ${CLEAN_ACCOUNT_STATE_MACHINE_ARN} for account ${account.id}`
      );
      await sf
        .startExecution({
          stateMachineArn: CLEAN_ACCOUNT_STATE_MACHINE_ARN,
          name: uuidv4(),
          input: JSON.stringify({
            id: account.id,
          }),
        })
        .promise();
    }

    return {
      statusCode: 200,
      body: JSON.stringify({}),
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
