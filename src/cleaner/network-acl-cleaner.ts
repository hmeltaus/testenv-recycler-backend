import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { NetworkAcl } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class NetworkAclCleaner extends AwsCleaner<EC2, NetworkAcl> {
  static readonly resourceType = "NetworkAcl";
  readonly resourceType = NetworkAclCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (client: EC2): Promise<NetworkAcl[]> =>
    this.pagedOperation(
      (params) => client.describeNetworkAcls(params),
      {},
      (response) => response.NetworkAcls!
    ).then((acls) => acls.filter((a) => !a.IsDefault));

  protected cleanResource = async (
    client: EC2,
    resource: NetworkAcl
  ): Promise<CleanResult> =>
    client
      .deleteNetworkAcl({ NetworkAclId: resource.NetworkAclId })
      .promise()
      .then(() => ({ id: resource.NetworkAclId, status: "success" }));

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
