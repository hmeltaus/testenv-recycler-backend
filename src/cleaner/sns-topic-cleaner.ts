import { CredentialProviderChain, Credentials, SNS } from "aws-sdk";
import { Topic } from "aws-sdk/clients/sns";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class SnsTopicCleaner extends AwsCleaner<SNS, Topic> {
  static readonly resourceType = "SnsTopic";
  readonly resourceType = SnsTopicCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (client: SNS): Promise<Topic[]> =>
    this.pagedOperation(
      (params) => client.listTopics(params),
      {},
      (response) => response.Topics!
    );

  protected cleanResource = async (
    client: SNS,
    resource: Topic
  ): Promise<CleanResult> =>
    client
      .deleteTopic({ TopicArn: resource.TopicArn })
      .promise()
      .then(() => ({ id: resource.TopicArn, status: "success" }));

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): SNS =>
    new SNS({
      ...options,
      credentials,
      region,
    });
}
