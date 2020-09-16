import { Handler } from "aws-lambda";
import { CleanerRegistries } from "../../cleaner/cleaner-registries";
import { Environment } from "../../model";

interface LoadResourcesInput {
  environment: Environment;
}

interface LoadResourcesOutput {
  resources: string[];
  environment: Environment;
}

export const loadResources: Handler<
  LoadResourcesInput,
  LoadResourcesOutput
> = async ({ environment }, _context) => {
  const registries = new CleanerRegistries();
  const resources = await registries.getResourcesInExecutionOrder(
    environment.type
  );
  return { resources, environment };
};
