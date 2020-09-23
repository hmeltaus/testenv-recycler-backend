import {
  AWSError,
  ChainableTemporaryCredentials,
  CredentialProviderChain,
  Credentials,
  Request,
} from "aws-sdk";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import * as https from "https";
import { Account } from "../model";
import { sleep } from "../util";
import { Cleaner } from "./cleaner";

export interface PagedResponse {
  readonly nextToken?: string;
  readonly NextToken?: string;
}

const maxRetries = 30;
const retryableErrorCodes = [
  "UnknownEndpoint",
  "Throttling",
  "TooManyRequestsException",
];

export const randomInt = (min: number, max: number): number => {
  const minC = Math.ceil(min);
  const maxF = Math.floor(max);
  return Math.floor(Math.random() * (maxF - minC + 1) + minC);
};

export interface CleanResult {
  id: string;
  status: "success" | "retry" | "error";
}

export abstract class AwsCleaner<C, A> implements Cleaner {
  abstract readonly resourceType: string;
  abstract readonly depends: string[];

  protected constructor(
    readonly credentialProvider: CredentialProviderChain,
    readonly regions: string[]
  ) {}

  getCredentials = async (): Promise<Credentials> =>
    this.credentialProvider.resolvePromise();

  credentialProviderForRole = async (
    iamRoleArn: string
  ): Promise<CredentialProviderChain> =>
    this.getCredentials().then(
      (masterCredentials) =>
        new CredentialProviderChain([
          () =>
            new ChainableTemporaryCredentials({
              params: {
                RoleArn: iamRoleArn,
                DurationSeconds: 3600,
                RoleSessionName: "testenv-recycler",
              },
              masterCredentials,
            }),
        ])
    );

  private cleanResourceInternal = async (
    client: C,
    resource: A,
    region: string
  ): Promise<string> => {
    console.log(
      `About to clean resource of type '${
        this.resourceType
      }' from region ${region}:\n\n${JSON.stringify(resource)}`
    );
    const { id, status } = await this.cleanResource(client, resource);
    switch (status) {
      case "retry":
        await sleep(1000);
        const refreshed = await this.refreshResource(client, resource);
        return this.cleanResourceInternal(client, refreshed, region);
      case "success":
        return id;
      default:
        throw new Error(
          `Unsupported result status '${status}' when cleaning resource '${id}' of type ${this.resourceType}`
        );
    }
  };

  clean = async (account: Account): Promise<boolean> => {
    for (const region of this.regions) {
      console.log(`About to clean region ${region} of account ${account.id}`);
      const client = await this.getClient(account, region);
      const resources = await this.getResourcesToClean(client);
      console.log(
        `Found ${resources.length} resources of type ${this.resourceType} from region ${region}`
      );

      const ids = [];
      for (const resource of resources) {
        const id = await this.cleanResourceInternal(client, resource, region);
        ids.push(id);
        console.log(
          `Cleaned resource ${id} of type ${this.resourceType} from region ${region}`
        );
      }

      console.log(
        `Cleaned ${ids.length} resources of type ${this.resourceType} from region ${region}`
      );
    }

    return true;
  };

  protected abstract createClient(
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): C;

  protected abstract async getResourcesToClean(client: C): Promise<A[]>;

  protected abstract async cleanResource(
    client: C,
    resource: A
  ): Promise<CleanResult>;

  protected refreshResource = async (
    // @ts-ignore
    client: C,
    resource: A
  ): Promise<A | undefined> => resource;

  protected clientOptions = (): ConfigurationOptions => {
    const agent = new https.Agent({
      keepAlive: true,
    });

    return {
      retryDelayOptions: {
        customBackoff: (retryCount: number, err?: any): number => {
          if (!retryableErrorCodes.includes(err?.code)) {
            console.log(
              `Request failed with error code '${err.code}', aborting`
            );
            return -1;
          }

          if (retryCount >= maxRetries) {
            console.log(
              `Request failed with error code '${err.code}', max retries ${maxRetries} reached, aborting`
            );
            return -1;
          }

          const expBackoff = Math.pow(2, retryCount);
          const maxJitter = Math.ceil(expBackoff * 200);
          const backoff = Math.round(expBackoff + randomInt(0, maxJitter));
          const maxBackoff = randomInt(15000, 20000);
          const finalBackoff = Math.min(maxBackoff, backoff);
          console.log(
            `Request failed with error code '${err?.code}', pause for ${finalBackoff}ms and try again (retry count: ${retryCount})`
          );
          return finalBackoff;
        },
      },
      maxRetries,
      httpOptions: {
        agent,
      },
    };
  };

  private getCredentialsForAccount = async (
    account: Account
  ): Promise<Credentials> => {
    if (account.managementRoleArn) {
      const cp = await this.credentialProviderForRole(
        account.managementRoleArn
      );
      return cp.resolvePromise();
    }

    return this.getCredentials();
  };

  protected getClient = async (account: Account, region: string): Promise<C> =>
    this.getCredentialsForAccount(account).then((credentials) =>
      this.createClient(credentials, region, this.clientOptions())
    );

  protected withClient = async <T>(
    account: Account,
    region: string,
    fn: (client: C) => Promise<T>
  ): Promise<T> =>
    this.getCredentialsForAccount(account)
      .then((credentials) =>
        this.createClient(credentials, region, this.clientOptions())
      )
      .then(fn);

  protected withClientPromise = async <T, R>(
    account: Account,
    region: string,
    fn: (client: C) => Request<R, AWSError>,
    onSuccess: (result: R) => T,
    onError?: (e: any) => T
  ): Promise<T> =>
    this.getCredentialsForAccount(account)
      .then((credentials) =>
        this.createClient(credentials, region, this.clientOptions())
      )
      .then((client) => fn(client).promise())
      .then(onSuccess)
      .catch((e) => {
        if (onError) {
          return onError(e);
        }
        throw e;
      });

  protected pagedOperation = async <T, P, R extends PagedResponse>(
    operation: (params: P) => Request<R, AWSError>,
    params: P,
    extractor: (response: R) => T[] | undefined,
    previousResponse?: PagedResponse
  ): Promise<T[]> => {
    const nextTokenName =
      previousResponse && previousResponse.NextToken
        ? "NextToken"
        : "nextToken";

    const nextTokenValue = previousResponse
      ? previousResponse[nextTokenName]
      : undefined;

    const newParams = nextTokenValue
      ? {
          ...params,
          [nextTokenName]: nextTokenValue,
        }
      : params;

    const response = await operation(newParams).promise();

    const items = extractor(response) || [];
    if (!response.nextToken && !response.NextToken) {
      return items;
    }

    return [
      ...items,
      ...(await this.pagedOperation(operation, params, extractor, response)),
    ];
  };
}
