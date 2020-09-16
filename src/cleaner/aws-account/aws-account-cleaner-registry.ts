import { CredentialProviderChain } from "aws-sdk";
import { Cleaner } from "../cleaner";
import { CleanerRegistry } from "../cleaner-registry";
import { AwsAccountEnvironmentData, AwsCleaner } from "./aws-cleaner";
import { LogGroupAwsCleaner } from "./log-group-aws-cleaner";

export class AwsAccountCleanerRegistry implements CleanerRegistry {
  readonly regions = ["eu-west-1", "eu-central-1"];
  readonly environmentType: string = "aws-account";
  readonly credentialProvider: CredentialProviderChain = new CredentialProviderChain();
  readonly cleaners: AwsCleaner<any, any>[];

  constructor() {
    this.cleaners = [
      new LogGroupAwsCleaner(this.credentialProvider, this.regions),
    ];
  }

  getCleaners = async (): Promise<Cleaner<AwsAccountEnvironmentData>[]> =>
    this.cleaners.slice();

  getCleaner = (
    resourceType: string
  ): Cleaner<AwsAccountEnvironmentData> | null =>
    this.cleaners.find((c) => c.resourceType === resourceType) || null;
}
