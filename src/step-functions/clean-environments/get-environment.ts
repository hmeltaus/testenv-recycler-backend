import { Handler } from "aws-lambda";
import { getEnvironmentFromDB } from "../../db/environment";
import { Environment } from "../../model";

interface GetEnvironmentInput {
  id: string;
  type: string;
}

interface GetEnvironmentOutput {
  environment?: Environment;
  environmentStatus: string;
}

export const getEnvironment: Handler<
  GetEnvironmentInput,
  GetEnvironmentOutput
> = async ({ id, type }, _context) => {
  if (!id || !type) {
    throw new Error(`Environment id and type are required`);
  }

  const environment = await getEnvironmentFromDB(id, type);
  if (environment) {
    console.log(
      `Found environment:\n\n${JSON.stringify(environment, null, 2)}`
    );
    return {
      environmentStatus: environment.status,
      environment,
    };
  }

  return { environmentStatus: "not-found" };
};
