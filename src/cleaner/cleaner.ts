export interface EnvironmentData {}

export interface Cleaner<D extends EnvironmentData> {
  readonly environmentType: string;
  readonly resourceType: string;
  readonly depends: string[];
  clean: (environmentData: D) => Promise<boolean>;
}
