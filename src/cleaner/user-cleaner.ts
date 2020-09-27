import { CredentialProviderChain, Credentials, IAM } from "aws-sdk";
import { User } from "aws-sdk/clients/iam";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class UserCleaner extends AwsCleaner<IAM, User> {
  static readonly resourceType = "User";
  readonly resourceType = UserCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (client: IAM): Promise<User[]> =>
    this.pagedOperation(
      (params) => client.listUsers(params),
      {},
      (response) => response.Users!
    );

  protected cleanResource = async (
    client: IAM,
    resource: User
  ): Promise<CleanResult> =>
    client
      .deleteUser({ UserName: resource.UserName })
      .promise()
      .then(() => ({ id: resource.UserName, status: "success" }));

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): IAM =>
    new IAM({
      ...options,
      credentials,
      region,
    });
}
