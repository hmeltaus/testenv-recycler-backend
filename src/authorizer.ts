import {
  APIGatewayAuthorizerHandler,
  APIGatewayTokenAuthorizerEvent,
} from "aws-lambda";
import { APIGatewayAuthorizerResultContext } from "aws-lambda/common/api-gateway";
import bcrypt from "bcryptjs";
import { getClientFromDB } from "./db";

const checkToken = async (token: string): Promise<boolean> => {
  console.log(token);

  const [id, password] = token.split(":", 2);

  if (!id || !password) {
    return false;
  }

  const client = await getClientFromDB(id);
  if (!client) {
    return false;
  }

  return bcrypt.compare(password, client.password);
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
