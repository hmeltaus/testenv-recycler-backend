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
import { Cleaner } from "./cleaner";

export interface PagedResponse {
  readonly nextToken?: string;
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

export abstract class AwsCleaner<C, A> implements Cleaner {
  readonly depends: string[] = [];
  abstract readonly resourceType: string;

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

  clean = async (account: Account): Promise<boolean> => {
    for (let region of this.regions) {
      console.log(`About to clean region: ${region}`);
      const resources = await this.getResourcesToClean(account, region);
      console.log(
        `Found ${resources.length} resources of type ${this.resourceType} from region ${region}`
      );
      const ids = await Promise.all(
        resources
          .map((r) => this.cleanResource(account, region, r))
          .map((id) => {
            console.log(
              `Cleaned resource ${id} of type ${this.resourceType} from region ${region}`
            );
            return id;
          })
      );

      console.log(
        `Cleaned ${ids.length} resources of type ${this.resourceType} from region ${region}`
      );
    }

    return true;
  };

  protected abstract getClient(
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): C;

  protected abstract getResourcesToClean(
    account: Account,
    region: string
  ): Promise<A[]>;

  protected abstract cleanResource(
    account: Account,
    region: string,
    resource: A
  ): Promise<string>;

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

  protected withClient = async <T>(
    account: Account,
    region: string,
    fn: (client: C) => Promise<T>
  ): Promise<T> =>
    this.getCredentialsForAccount(account)
      .then((credentials) =>
        this.getClient(credentials, region, this.clientOptions())
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
        this.getClient(credentials, region, this.clientOptions())
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
    nextToken?: string
  ): Promise<T[]> => {
    const response = await operation({
      ...params,
      nextToken,
    }).promise();

    const items = extractor(response) || [];
    if (!response.nextToken) {
      return items;
    }

    return [
      ...items,
      ...(await this.pagedOperation(
        operation,
        params,
        extractor,
        response.nextToken
      )),
    ];
  };
}
