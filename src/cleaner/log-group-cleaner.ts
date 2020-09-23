import { CloudWatchLogs, CredentialProviderChain, Credentials } from "aws-sdk";
import { LogGroup } from "aws-sdk/clients/cloudwatchlogs";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class LogGroupCleaner extends AwsCleaner<CloudWatchLogs, LogGroup> {
  static readonly resourceType = "LogGroup";
  readonly resourceType = LogGroupCleaner.resourceType;
  readonly depends = [];
  readonly excludeLogGroupsWithPrefix = "/aws/";

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    client: CloudWatchLogs
  ): Promise<LogGroup[]> =>
    this.pagedOperation(
      (params) => client.describeLogGroups(params),
      {},
      (response) => response.logGroups!
    ).then((resources) =>
      resources.filter(
        (r) => !r.logGroupName.startsWith(this.excludeLogGroupsWithPrefix)
      )
    );

  protected cleanResource = async (
    client: CloudWatchLogs,
    resource: LogGroup
  ): Promise<CleanResult> =>
    client
      .deleteLogGroup({ logGroupName: resource.logGroupName })
      .promise()
      .then(() => ({ id: resource.logGroupName, status: "success" }));

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): CloudWatchLogs =>
    new CloudWatchLogs({
      ...options,
      credentials,
      region,
    });
}
