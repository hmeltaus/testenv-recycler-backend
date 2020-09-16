import { AwsAccountCleanerRegistry } from "./aws-account/aws-account-cleaner-registry";
import { Cleaner, EnvironmentData } from "./cleaner";
import { CleanerRegistry } from "./cleaner-registry";

const sortCleaners = (
  cleaners: Cleaner<EnvironmentData>[]
): Cleaner<EnvironmentData>[] =>
  cleaners.slice().sort((a, b) => {
    if (a.depends.length === 0) {
      return -1;
    }
    if (b.depends.length === 0) {
      return 1;
    }
    if (b.depends.includes(a.resourceType)) {
      return -1;
    }
    if (a.depends.includes(b.resourceType)) {
      return 1;
    }

    return 0;
  });

export class CleanerRegistries {
  private readonly cleanerRegistries: CleanerRegistry[];
  constructor() {
    this.cleanerRegistries = [new AwsAccountCleanerRegistry()];
  }

  getResourcesInExecutionOrder = async (
    environmentType: string
  ): Promise<string[]> => {
    const registry = this.cleanerRegistries.find(
      (r) => r.environmentType === environmentType
    );

    if (!registry) {
      throw new Error(`Unknown environment type: ${environmentType}`);
    }

    return sortCleaners(await registry.getCleaners()).map(
      (c) => c.resourceType
    );
  };

  getCleaner = (
    environmentType: string,
    resourceType: string
  ): Cleaner<EnvironmentData> => {
    const registry = this.cleanerRegistries.find(
      (r) => r.environmentType === environmentType
    );

    if (!registry) {
      throw new Error(`Unknown environment type: ${environmentType}`);
    }

    const cleaner = registry.getCleaner(resourceType);
    if (!cleaner) {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }

    return cleaner;
  };
}
