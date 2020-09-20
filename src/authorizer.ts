import {
  APIGatewayAuthorizerHandler,
  APIGatewayTokenAuthorizerEvent,
} from "aws-lambda";
import { APIGatewayAuthorizerResultContext } from "aws-lambda/common/api-gateway";
import {
  checkExpirationStatus,
  DecodeResult,
  decodeSession,
  ExpirationStatus,
  getJwtSecret,
} from "./auth";

const checkToken = async (header: string): Promise<boolean> => {
  const [alg, token] = header.split(" ");
  if (alg !== "Bearer") {
    return false;
  }

  const secret = await getJwtSecret();

  const decodedSession: DecodeResult = decodeSession(secret, token);
  if (
    decodedSession.type === "integrity-error" ||
    decodedSession.type === "invalid-token"
  ) {
    return false;
  }

  const expiration: ExpirationStatus = checkExpirationStatus(
    decodedSession.session
  );

  return expiration === "active";
};

export const authorize: APIGatewayAuthorizerHandler = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: APIGatewayAuthorizerResultContext
) => {
  const token = event.authorizationToken;
  const effect = (await checkToken(token)) ? "Allow" : "Deny";

  return {
    context,
    principalId: "user",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: event.methodArn,
        },
      ],
    },
  };
};
