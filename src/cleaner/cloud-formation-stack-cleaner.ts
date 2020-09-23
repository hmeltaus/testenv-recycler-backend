import { CloudFormation, CredentialProviderChain, Credentials } from "aws-sdk";
import { Stack } from "aws-sdk/clients/cloudformation";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { Account } from "../model";
import { AwsCleaner, CleanResult } from "./aws-cleaner";
import { IgwCleaner } from "./igw-cleaner";
import { LogGroupCleaner } from "./log-group-cleaner";
import { NetworkAclCleaner } from "./network-acl-cleaner";
import { SubnetCleaner } from "./subnet-cleaner";
import { VpcCleaner } from "./vpc-cleaner";

export class CloudFormationStackCleaner extends AwsCleaner<
  CloudFormation,
  Stack
> {
  static readonly resourceType = "CloudFormationStack";
  readonly resourceType = CloudFormationStackCleaner.resourceType;
  readonly depends = [
    LogGroupCleaner.resourceType,
    VpcCleaner.resourceType,
    IgwCleaner.resourceType,
    NetworkAclCleaner.resourceType,
    SubnetCleaner.resourceType,
  ];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    account: Account,
    region: string
  ): Promise<Stack[]> =>
    this.withClient(account, region, (c) =>
      this.pagedOperation(
        (params) => c.describeStacks(params),
        {},
        (response) => response.Stacks!
      )
    );

  protected cleanResource = async (
    account: Account,
    region: string,
    resource: Stack
  ): Promise<CleanResult> =>
    this.withClientPromise(
      account,
      region,
      (c) => c.deleteStack({ StackName: resource.StackId }),
      () => ({ id: resource.StackId, status: "success" })
    );

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): CloudFormation =>
    new CloudFormation({
      ...options,
      credentials,
      region,
    });
}
