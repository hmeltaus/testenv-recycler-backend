import { CredentialProviderChain, Credentials, SQS } from "aws-sdk";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class SqsQueueCleaner extends AwsCleaner<SQS, string> {
  static readonly resourceType = "SqsQueue";
  readonly resourceType = SqsQueueCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (client: SQS): Promise<string[]> =>
    this.pagedOperation(
      (params) => client.listQueues(params),
      {},
      (response) => response.QueueUrls!
    );

  protected cleanResource = async (
    client: SQS,
    resource: string
  ): Promise<CleanResult> =>
    client
      .deleteQueue({ QueueUrl: resource })
      .promise()
      .then(() => ({ id: resource, status: "success" }));

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): SQS =>
    new SQS({
      ...options,
      credentials,
      region,
    });
}
