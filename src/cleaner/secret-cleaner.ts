import { CredentialProviderChain, Credentials, SecretsManager } from "aws-sdk";
import { SecretListEntry } from "aws-sdk/clients/secretsmanager";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class SecretCleaner extends AwsCleaner<SecretsManager, SecretListEntry> {
  static readonly resourceType = "Secret";
  readonly resourceType = SecretCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    client: SecretsManager
  ): Promise<SecretListEntry[]> =>
    this.pagedOperation(
      (params) => client.listSecrets(params),
      {},
      (response) => response.SecretList!
    ).then((resources) =>
      resources.filter((r) =>
        r.Tags.some((t) => t.Key === "test-resource" && t.Value === "true")
      )
    );

  protected cleanResource = async (
    client: SecretsManager,
    resource: SecretListEntry
  ): Promise<CleanResult> =>
    client
      .deleteSecret({
        SecretId: resource.ARN,
        ForceDeleteWithoutRecovery: true,
      })
      .promise()
      .then(() => ({ id: resource.ARN, status: "success" }));

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): SecretsManager =>
    new SecretsManager({
      ...options,
      credentials,
      region,
    });
}
