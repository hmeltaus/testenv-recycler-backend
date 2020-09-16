import { Handler } from "aws-lambda";
import { CleanerRegistries } from "../../cleaner/cleaner-registries";
import { setEnvironmentAsReadyInDB } from "../../db/environment";
import { Environment } from "../../model";

interface CleanResourceInput {
  environment: Environment;
  resources: string[];
}

interface CleanResourceOutput {
  environment: Environment;
  resources: string[];
  ready: boolean;
}

export const cleanResource: Handler<
  CleanResourceInput,
  CleanResourceOutput
> = async ({ environment, resources }, _context) => {
  if (resources.length === 0) {
    console.log("No more resources to clean");
    await setEnvironmentAsReadyInDB(environment.id, environment.type);
    return {
      ready: true,
      resources,
      environment,
    };
  }

  const resource = resources[0];

  console.log(`Cleaning resource: ${resource}`);
  const registries = new CleanerRegistries();
  const cleaner = await registries.getCleaner(environment.type, resource);
  await cleaner.clean(environment.data);

  return {
    resources: resources.slice(1),
    ready: false,
    environment,
  };
};
