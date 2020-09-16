import { CloudWatchLogs, CredentialProviderChain, Credentials } from "aws-sdk";
import { LogGroup } from "aws-sdk/clients/cloudwatchlogs";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsAccountEnvironmentData, AwsCleaner } from "./aws-cleaner";

export class LogGroupAwsCleaner extends AwsCleaner<CloudWatchLogs, LogGroup> {
  readonly resourceType = "LogGroup";
  readonly excludeLogGroupsWithPrefix = "/aws/";

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    data: AwsAccountEnvironmentData,
    region: string
  ): Promise<LogGroup[]> =>
    this.withClient(data, region, (c) =>
      this.pagedOperation(
        (params) => c.describeLogGroups(params),
        {},
        (response) => response.logGroups!
      )
    ).then((resources) =>
      resources.filter(
        (r) => !r.logGroupName.startsWith(this.excludeLogGroupsWithPrefix)
      )
    );

  protected cleanResource = async (
    data: AwsAccountEnvironmentData,
    region: string,
    resource: LogGroup
  ): Promise<string> =>
    this.withClientPromise(
      data,
      region,
      (c) => c.deleteLogGroup({ logGroupName: resource.logGroupName }),
      () => resource.logGroupName
    );

  protected getClient = (
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
