import { CloudWatchLogs, CredentialProviderChain, Credentials } from "aws-sdk";
import { LogGroup } from "aws-sdk/clients/cloudwatchlogs";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { Account } from "../model";
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
    account: Account,
    region: string
  ): Promise<LogGroup[]> =>
    this.withClient(account, region, (c) =>
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
    account: Account,
    region: string,
    resource: LogGroup
  ): Promise<CleanResult> =>
    this.withClientPromise(
      account,
      region,
      (c) => c.deleteLogGroup({ logGroupName: resource.logGroupName }),
      () => ({ id: resource.logGroupName, status: "success" })
    );

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
