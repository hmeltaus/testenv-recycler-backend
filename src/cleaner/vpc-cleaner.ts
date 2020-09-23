import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { Vpc } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { Account } from "../model";
import { AwsCleaner, CleanResult } from "./aws-cleaner";
import { SubnetCleaner } from "./subnet-cleaner";

export class VpcCleaner extends AwsCleaner<EC2, Vpc> {
  static readonly resourceType = "Vpc";
  readonly resourceType = VpcCleaner.resourceType;
  readonly depends = [SubnetCleaner.resourceType];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    account: Account,
    region: string
  ): Promise<Vpc[]> =>
    this.withClient(account, region, (c) =>
      this.pagedOperation(
        (params) => c.describeVpcs(params),
        {},
        (response) => response.Vpcs!
      )
    );

  protected cleanResource = async (
    account: Account,
    region: string,
    resource: Vpc
  ): Promise<CleanResult> =>
    this.withClientPromise(
      account,
      region,
      (c) => c.deleteVpc({ VpcId: resource.VpcId }),
      () => ({ id: resource.VpcId, status: "success" })
    );

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): EC2 =>
    new EC2({
      ...options,
      credentials,
      region,
    });
}
