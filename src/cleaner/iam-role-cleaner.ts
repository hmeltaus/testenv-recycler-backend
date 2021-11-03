import { CredentialProviderChain, Credentials, IAM } from "aws-sdk";
import { Role } from "aws-sdk/clients/iam";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class IamRoleCleaner extends AwsCleaner<IAM, Role> {
  static readonly resourceType = "IamRole";
  readonly resourceType = IamRoleCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (client: IAM): Promise<Role[]> =>
    this.pagedOperation(
      (params) => client.listRoles(params),
      {},
      (response) => response.Roles!
    ).then((roles) =>
      roles.filter((role) =>
        role.Tags.some((t) => t.Key === "test-resource" && t.Value === "true")
      )
    );

  protected cleanResource = async (
    client: IAM,
    resource: Role
  ): Promise<CleanResult> =>
    client
      .deleteRole({ RoleName: resource.RoleName })
      .promise()
      .then(() => ({ id: resource.RoleName, status: "success" }));

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
