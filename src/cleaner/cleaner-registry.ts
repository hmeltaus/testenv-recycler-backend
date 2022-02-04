import { CredentialProviderChain } from "aws-sdk";
import { AwsCleaner } from "./aws-cleaner";
import { Cleaner } from "./cleaner";
import { CloudFormationStackCleaner } from "./cloud-formation-stack-cleaner";
import { IamRoleCleaner } from "./iam-role-cleaner";
import { IgwCleaner } from "./igw-cleaner";
import { LogGroupCleaner } from "./log-group-cleaner";
import { NetworkAclCleaner } from "./network-acl-cleaner";
import { RouteTableCleaner } from "./route-table-cleaner";
import { S3BucketCleaner } from "./s3-bucket-cleaner";
import { SecretCleaner } from "./secret-cleaner";
import { SecurityGroupCleaner } from "./security-group-cleaner";
import { SnsTopicCleaner } from "./sns-topic-cleaner";
import { SqsQueueCleaner } from "./sqs-queue-cleaner";
import { SsmParameterCleaner } from "./ssm-parameter-cleaner";
import { SubnetCleaner } from "./subnet-cleaner";
import { UserCleaner } from "./user-cleaner";
import { VpcCleaner } from "./vpc-cleaner";

interface CleanerItem {
  readonly cleaner: Cleaner;
  readonly resourceType: string;
  readonly dependencies: string[];
}

const checkCyclicDependencies = (
  cleaner: Cleaner,
  cleanersByResourceType: Map<string, Cleaner>,
  path: string[]
): void => {
  cleaner.depends.forEach((d) => {
    if (path.includes(d)) {
      throw new Error(
        `Cyclic dependency detected '${path.join(" -> ")} -> ${d}'`
      );
    }

    checkCyclicDependencies(
      cleanersByResourceType.get(d),
      cleanersByResourceType,
      [...path, d]
    );
  });
};

const checkNonExistingDependencies = (
  cleaner: Cleaner,
  cleanersByResourceType: Map<string, Cleaner>
): void => {
  cleaner.depends.forEach((d) => {
    if (!cleanersByResourceType.has(d)) {
      throw new Error(
        `Cleaner of resource type '${cleaner.resourceType}' specifies a non-existing dependency '${d}'`
      );
    }
  });
};

const collectAllDependencies = (
  cleaner: Cleaner,
  cleanersByResourceType: Map<string, Cleaner>,
  collected: Set<string>
): void => {
  cleaner.depends.forEach((d) => {
    collected.add(d);
    collectAllDependencies(
      cleanersByResourceType.get(d),
      cleanersByResourceType,
      collected
    );
  });
};

const collectCleanerItems = (cleaners: Cleaner[]): CleanerItem[] => {
  const cleanersByResourceType = new Map(
    cleaners.map((c) => [c.resourceType, c])
  );
  cleaners.forEach((c) =>
    checkNonExistingDependencies(c, cleanersByResourceType)
  );
  cleaners.forEach((c) =>
    checkCyclicDependencies(c, cleanersByResourceType, [c.resourceType])
  );

  return cleaners.map((c) => {
    const allDependencies = new Set<string>();
    collectAllDependencies(c, cleanersByResourceType, allDependencies);

    return {
      cleaner: c,
      resourceType: c.resourceType,
      dependencies: Array.from(allDependencies),
    };
  });
};

const compare = (a: CleanerItem, b: CleanerItem): number => {
  if (a.dependencies.length === 0) {
    return -1;
  }
  if (b.dependencies.length === 0) {
    return 1;
  }
  if (a.dependencies.includes(b.resourceType)) {
    return 1;
  }
  if (b.dependencies.includes(a.resourceType)) {
    return -1;
  }

  return 0;
};

const sortCleaners = (cleaners: Cleaner[]): Cleaner[] => {
  if (cleaners.length === 0) {
    return [];
  }
  if (cleaners.length === 1) {
    return [cleaners[0]];
  }

  const items = collectCleanerItems(cleaners);
  const sorted = new Array<CleanerItem>();

  while (items.length > 0) {
    let candidateIndex = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const candidate = items[candidateIndex];
      const result = compare(item, candidate);
      if (result === -1) {
        candidateIndex = i;
      }
    }

    sorted.push(items[candidateIndex]);
    items.splice(candidateIndex, 1);
  }

  return sorted.map(({ cleaner }) => cleaner);
};

export class CleanerRegistry {
  readonly regions = ["eu-west-1", "eu-central-1", "eu-north-1"];
  readonly credentialProvider: CredentialProviderChain = new CredentialProviderChain();
  readonly cleaners: AwsCleaner<any, any>[];

  constructor() {
    this.cleaners = [
      new S3BucketCleaner(this.credentialProvider, this.regions),
      new LogGroupCleaner(this.credentialProvider, this.regions),
      new VpcCleaner(this.credentialProvider, this.regions),
      new CloudFormationStackCleaner(this.credentialProvider, this.regions),
      new IgwCleaner(this.credentialProvider, this.regions),
      new SubnetCleaner(this.credentialProvider, this.regions),
      new NetworkAclCleaner(this.credentialProvider, this.regions),
      new RouteTableCleaner(this.credentialProvider, this.regions),
      new SecurityGroupCleaner(this.credentialProvider, this.regions),
      new UserCleaner(this.credentialProvider, this.regions),
      new SqsQueueCleaner(this.credentialProvider, this.regions),
      new SnsTopicCleaner(this.credentialProvider, this.regions),
      new SsmParameterCleaner(this.credentialProvider, this.regions),
      new IamRoleCleaner(this.credentialProvider, this.regions),
      new SecretCleaner(this.credentialProvider, this.regions),
    ];
  }

  getCleaners = async (): Promise<Cleaner[]> =>
    sortCleaners(this.cleaners.slice());

  getCleaner = (resourceType: string): Cleaner | null =>
    this.cleaners.find((c) => c.resourceType === resourceType) || null;
}
