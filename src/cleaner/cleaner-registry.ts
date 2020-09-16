import { Cleaner, EnvironmentData } from "./cleaner";

export interface CleanerRegistry {
  readonly environmentType: string;
  getCleaners: () => Promise<Cleaner<EnvironmentData>[]>;
  getCleaner: (resourceType: string) => Cleaner<EnvironmentData>;
}
