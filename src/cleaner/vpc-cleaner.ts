import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { Vpc } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";
import { SubnetCleaner } from "./subnet-cleaner";

export class VpcCleaner extends AwsCleaner<EC2, Vpc> {
  static readonly resourceType = "Vpc";
  readonly resourceType = VpcCleaner.resourceType;
  readonly depends = [SubnetCleaner.resourceType];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (client: EC2): Promise<Vpc[]> =>
    this.pagedOperation(
      (params) => client.describeVpcs(params),
      {},
      (response) => response.Vpcs!
    );

  protected cleanResource = async (
    client: EC2,
    resource: Vpc
  ): Promise<CleanResult> =>
    client
      .deleteVpc({ VpcId: resource.VpcId })
      .promise()
      .then(() => ({ id: resource.VpcId, status: "success" }));

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
