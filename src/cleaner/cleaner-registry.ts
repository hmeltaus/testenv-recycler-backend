import { CredentialProviderChain } from "aws-sdk";
import { AwsCleaner } from "./aws-cleaner";
import { Cleaner } from "./cleaner";
import { LogGroupAwsCleaner } from "./log-group-aws-cleaner";

const sortCleaners = (cleaners: Cleaner[]): Cleaner[] =>
  cleaners.slice().sort((a, b) => {
    if (a.depends.length === 0) {
      return -1;
    }
    if (b.depends.length === 0) {
      return 1;
    }
    if (b.depends.includes(a.resourceType)) {
      return -1;
    }
    if (a.depends.includes(b.resourceType)) {
      return 1;
    }

    return 0;
  });

export class CleanerRegistry {
  readonly regions = ["eu-west-1", "eu-central-1"];
  readonly credentialProvider: CredentialProviderChain = new CredentialProviderChain();
  readonly cleaners: AwsCleaner<any, any>[];

  constructor() {
    this.cleaners = [
      new LogGroupAwsCleaner(this.credentialProvider, this.regions),
    ];
  }

  getCleaners = async (): Promise<Cleaner[]> =>
    sortCleaners(this.cleaners.slice());

  getCleaner = (resourceType: string): Cleaner | null =>
    this.cleaners.find((c) => c.resourceType === resourceType) || null;
}
