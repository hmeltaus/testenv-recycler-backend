import { CredentialProviderChain, Credentials, SSM } from "aws-sdk";
import { ParameterMetadata } from "aws-sdk/clients/ssm";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class SsmParameterCleaner extends AwsCleaner<SSM, ParameterMetadata> {
  static readonly resourceType = "SsmParameter";
  readonly resourceType = SsmParameterCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    client: SSM
  ): Promise<ParameterMetadata[]> =>
    this.pagedOperation(
      (params) => client.describeParameters(params),
      {},
      (response) => response.Parameters!
    );

  protected cleanResource = async (
    client: SSM,
    resource: ParameterMetadata
  ): Promise<CleanResult> =>
    client
      .deleteParameter({ Name: resource.Name })
      .promise()
      .then(() => ({ id: resource.Name, status: "success" }));

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): SSM =>
    new SSM({
      ...options,
      credentials,
      region,
    });
}
