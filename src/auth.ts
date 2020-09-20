import { SecretsManager } from "aws-sdk";
import { decode, encode, TAlgorithm } from "jwt-simple";
import { JWT_SECRET_NAME } from "./config";

const sm = new SecretsManager({ region: process.env.AWS_REGION });

export const getJwtSecret = async (): Promise<string> =>
  sm
    .getSecretValue({ SecretId: JWT_SECRET_NAME })
    .promise()
    .then((res) => res.SecretString);

export interface Session {
  dateCreated: number;
  username: string;
  /**
   * Timestamp indicating when the session was created, in Unix milliseconds.
   */
  issued: number;
  /**
   * Timestamp indicating when the session should expire, in Unix milliseconds.
   */
  expires: number;
}

export type PartialSession = Omit<Session, "issued" | "expires">;

export interface EncodeResult {
  token: string;
  expires: number;
  issued: number;
}

export type DecodeResult =
  | {
      type: "valid";
      session: Session;
    }
  | {
      type: "integrity-error";
    }
  | {
      type: "invalid-token";
    };

export type ExpirationStatus = "expired" | "active" | "grace";

export function encodeSession(
  secretKey: string,
  partialSession: PartialSession
): EncodeResult {
  // Always use HS512 to sign the token
  const algorithm: TAlgorithm = "HS512";
  // Determine when the token should expire
  const issued = Date.now();
  const lifetime = 120 * 60 * 1000;
  const expires = issued + lifetime;
  const session: Session = {
    ...partialSession,
    issued: issued,
    expires: expires,
  };

  return {
    token: encode(session, secretKey, algorithm),
    issued: issued,
    expires: expires,
  };
}

export function decodeSession(
  secretKey: string,
  tokenString: string
): DecodeResult {
  // Always use HS512 to decode the token
  const algorithm: TAlgorithm = "HS512";

  try {
    const session = decode(tokenString, secretKey, false, algorithm);
    return {
      type: "valid",
      session,
    };
  } catch (_e) {
    const e: Error = _e;

    // These error strings can be found here:
    // https://github.com/hokaccha/node-jwt-simple/blob/c58bfe5e5bb049015fcd55be5fc1b2d5c652dbcd/lib/jwt.js
    if (
      e.message === "No token supplied" ||
      e.message === "Not enough or too many segments"
    ) {
      return {
        type: "invalid-token",
      };
    }

    if (
      e.message === "Signature verification failed" ||
      e.message === "Algorithm not supported"
    ) {
      return {
        type: "integrity-error",
      };
    }

    // Handle json parse errors, thrown when the payload is nonsense
    if (e.message.indexOf("Unexpected token") === 0) {
      return {
        type: "invalid-token",
      };
    }

    throw e;
  }
}

export function checkExpirationStatus(token: Session): ExpirationStatus {
  const now = Date.now();

  if (token.expires > now) return "active";

  // Find the timestamp for the end of the token's grace period
  const threeHoursInMs = 3 * 60 * 60 * 1000;
  const threeHoursAfterExpiration = token.expires + threeHoursInMs;

  if (threeHoursAfterExpiration > now) return "grace";

  return "expired";
}
