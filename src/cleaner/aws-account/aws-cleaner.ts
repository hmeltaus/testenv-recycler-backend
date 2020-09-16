import {
  AWSError,
  ChainableTemporaryCredentials,
  CredentialProviderChain,
  Credentials,
  Request,
} from "aws-sdk";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import * as https from "https";
import { Cleaner, EnvironmentData } from "../cleaner";

export interface AwsAccountEnvironmentData extends EnvironmentData {
  accountId: string;
  iamRoleArn?: string;
}

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

export abstract class AwsCleaner<C, A>
  implements Cleaner<AwsAccountEnvironmentData> {
  readonly environmentType: string = "aws-account";
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

  clean = async (data: AwsAccountEnvironmentData): Promise<boolean> => {
    for (let region of this.regions) {
      console.log(`About to clean region: ${region}`);
      const resources = await this.getResourcesToClean(data, region);
      console.log(
        `Found ${resources.length} resources of type ${this.resourceType} from region ${region}`
      );
      const ids = await Promise.all(
        resources
          .map((r) => this.cleanResource(data, region, r))
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
    data: AwsAccountEnvironmentData,
    region: string
  ): Promise<A[]>;

  protected abstract cleanResource(
    data: AwsAccountEnvironmentData,
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

  private getCredentialsForEnvironment = async (
    data: AwsAccountEnvironmentData
  ): Promise<Credentials> => {
    if (data.iamRoleArn) {
      const cp = await this.credentialProviderForRole(data.iamRoleArn);
      return cp.resolvePromise();
    }

    return this.getCredentials();
  };

  protected withClient = async <T>(
    data: AwsAccountEnvironmentData,
    region: string,
    fn: (client: C) => Promise<T>
  ): Promise<T> =>
    this.getCredentialsForEnvironment(data)
      .then((credentials) =>
        this.getClient(credentials, region, this.clientOptions())
      )
      .then(fn);

  protected withClientPromise = async <T, R>(
    data: AwsAccountEnvironmentData,
    region: string,
    fn: (client: C) => Request<R, AWSError>,
    onSuccess: (result: R) => T,
    onError?: (e: any) => T
  ): Promise<T> =>
    this.getCredentialsForEnvironment(data)
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
