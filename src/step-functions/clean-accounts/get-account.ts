import { Handler } from "aws-lambda";
import { getAccountFromDB } from "../../db/account";
import { Account } from "../../model";

interface GetAccountInput {
  id: string;
}

interface GetAccountOutput {
  account?: Account;
  accountStatus: string;
}

export const getAccount: Handler<GetAccountInput, GetAccountOutput> = async (
  { id },
  _context
) => {
  if (!id) {
    throw new Error(`Account id is required`);
  }

  const account = await getAccountFromDB(id);
  if (account) {
    return {
      accountStatus: account.status,
      account,
    };
  }

  return { accountStatus: "not-found" };
};
