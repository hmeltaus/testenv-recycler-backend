import { Handler } from "aws-lambda";
import { CleanerRegistry } from "../../cleaner/cleaner-registry";
import { Account } from "../../model";

interface LoadResourcesInput {
  account: Account;
}

interface LoadResourcesOutput {
  resources: string[];
  account: Account;
}

export const loadResources: Handler<
  LoadResourcesInput,
  LoadResourcesOutput
> = async ({ account }, _context) => {
  const registry = new CleanerRegistry();
  const resources = await registry
    .getCleaners()
    .then((c) => c.map((r) => r.resourceType));
  return { resources, account };
};
