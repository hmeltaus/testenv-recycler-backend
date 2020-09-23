import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { Subnet } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { Account } from "../model";
import { AwsCleaner, CleanResult } from "./aws-cleaner";
import { NetworkAclCleaner } from "./network-acl-cleaner";

export class SubnetCleaner extends AwsCleaner<EC2, Subnet> {
  static readonly resourceType = "Subnet";
  readonly resourceType = SubnetCleaner.resourceType;
  readonly depends = [NetworkAclCleaner.resourceType];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    account: Account,
    region: string
  ): Promise<Subnet[]> =>
    this.withClient(account, region, (c) =>
      this.pagedOperation(
        (params) => c.describeSubnets(params),
        {},
        (response) => response.Subnets!
      )
    );

  protected cleanResource = async (
    account: Account,
    region: string,
    resource: Subnet
  ): Promise<CleanResult> =>
    this.withClientPromise(
      account,
      region,
      (c) => c.deleteSubnet({ SubnetId: resource.SubnetId }),
      () => ({ id: resource.SubnetId, status: "success" })
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
