import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { NetworkAcl } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { Account } from "../model";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class NetworkAclCleaner extends AwsCleaner<EC2, NetworkAcl> {
  static readonly resourceType = "NetworkAcl";
  readonly resourceType = NetworkAclCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    account: Account,
    region: string
  ): Promise<NetworkAcl[]> =>
    this.withClient(account, region, (c) =>
      this.pagedOperation(
        (params) => c.describeNetworkAcls(params),
        {},
        (response) => response.NetworkAcls!
      ).then((acls) => acls.filter((a) => !a.IsDefault))
    );

  protected cleanResource = async (
    account: Account,
    region: string,
    resource: NetworkAcl
  ): Promise<CleanResult> =>
    this.withClientPromise(
      account,
      region,
      (c) => c.deleteNetworkAcl({ NetworkAclId: resource.NetworkAclId }),
      () => ({ id: resource.NetworkAclId, status: "success" })
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
