import { CloudFormation, CredentialProviderChain, Credentials } from "aws-sdk";
import { Stack } from "aws-sdk/clients/cloudformation";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";
import { IamRoleCleaner } from "./iam-role-cleaner";
import { IgwCleaner } from "./igw-cleaner";
import { LogGroupCleaner } from "./log-group-cleaner";
import { NetworkAclCleaner } from "./network-acl-cleaner";
import { RouteTableCleaner } from "./route-table-cleaner";
import { S3BucketCleaner } from "./s3-bucket-cleaner";
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
    RouteTableCleaner.resourceType,
    S3BucketCleaner.resourceType,
    IamRoleCleaner.resourceType,
  ];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    client: CloudFormation
  ): Promise<Stack[]> =>
    this.pagedOperation(
      (params) => client.describeStacks(params),
      {},
      (response) => response.Stacks!
    );

  protected cleanResource = async (
    client: CloudFormation,
    resource: Stack
  ): Promise<CleanResult> =>
    client
      .updateTerminationProtection({
        StackName: resource.StackId,
        EnableTerminationProtection: false,
      })
      .promise()
      .then(() =>
        client
          .deleteStack({ StackName: resource.StackId })
          .promise()
          .then(() => ({ id: resource.StackId, status: "success" }))
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
