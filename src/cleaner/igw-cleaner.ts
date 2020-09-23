import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { InternetGateway } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { Account } from "../model";
import { AwsCleaner, CleanResult } from "./aws-cleaner";
import { RouteTableCleaner } from "./route-table-cleaner";

export class IgwCleaner extends AwsCleaner<EC2, InternetGateway> {
  static readonly resourceType = "Igw";
  readonly resourceType = IgwCleaner.resourceType;
  readonly depends = [RouteTableCleaner.resourceType];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    account: Account,
    region: string
  ): Promise<InternetGateway[]> =>
    this.withClient(account, region, (c) =>
      this.pagedOperation(
        (params) => c.describeInternetGateways(params),
        {},
        (response) => response.InternetGateways!
      )
    );

  protected cleanResource = async (
    account: Account,
    region: string,
    resource: InternetGateway
  ): Promise<CleanResult> =>
    this.withClientPromise(
      account,
      region,
      (c) =>
        c.deleteInternetGateway({
          InternetGatewayId: resource.InternetGatewayId,
        }),
      () => ({ id: resource.InternetGatewayId, status: "success" })
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
