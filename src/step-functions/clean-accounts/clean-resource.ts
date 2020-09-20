import { Handler } from "aws-lambda";
import { CleanerRegistry } from "../../cleaner/cleaner-registry";
import { setAccountAsReadyInDB } from "../../db/account";
import { Account } from "../../model";

interface CleanResourceInput {
  account: Account;
  resources: string[];
}

interface CleanResourceOutput {
  account: Account;
  resources: string[];
  ready: boolean;
}

export const cleanResource: Handler<
  CleanResourceInput,
  CleanResourceOutput
> = async ({ account, resources }, _context) => {
  if (resources.length === 0) {
    console.log("No more resources to clean");
    await setAccountAsReadyInDB(account.id);
    return {
      ready: true,
      resources,
      account,
    };
  }

  const resource = resources[0];

  console.log(`Cleaning resource: ${resource}`);
  const registry = new CleanerRegistry();
  const cleaner = await registry.getCleaner(resource);
  await cleaner.clean(account);

  return {
    resources: resources.slice(1),
    ready: false,
    account,
  };
};
