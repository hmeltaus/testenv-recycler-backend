import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { SecurityGroup } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class SecurityGroupCleaner extends AwsCleaner<EC2, SecurityGroup> {
  static readonly resourceType = "SecurityGroup";
  readonly resourceType = SecurityGroupCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    client: EC2
  ): Promise<SecurityGroup[]> =>
    this.pagedOperation(
      (params) => client.describeSecurityGroups(params),
      {},
      (response) => response.SecurityGroups!
    );

  protected cleanResource = async (
    client: EC2,
    resource: SecurityGroup
  ): Promise<CleanResult> =>
    client
      .deleteSecurityGroup({ GroupId: resource.GroupId })
      .promise()
      .then(() => ({ id: resource.GroupId, status: "success" }));

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
