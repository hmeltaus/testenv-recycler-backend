import { Account } from "../model";

export interface Cleaner {
  readonly resourceType: string;
  readonly depends: string[];
  clean: (account: Account) => Promise<boolean>;
}
