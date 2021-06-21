import { CredentialProviderChain, Credentials, S3 } from "aws-sdk";
import { Bucket } from "aws-sdk/clients/s3";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class S3BucketCleaner extends AwsCleaner<S3, Bucket> {
  static readonly resourceType = "S3Bucket";
  readonly resourceType = S3BucketCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (client: S3): Promise<Bucket[]> =>
    client
      .listBuckets()
      .promise()
      .then((response) => response.Buckets)
      .then(async (buckets) => {
        const bucketsWithData = await Promise.all(
          buckets.map(async (bucket) => {
            const location = await client.getBucketLocation({
              Bucket: bucket.Name,
            });

            const bucketRegion = location ?? "us-east-1";
            if (bucketRegion !== client.config.region) {
              return {
                bucket,
                include: false,
              };
            }

            const tagSet = await client
              .getBucketTagging({ Bucket: bucket.Name })
              .promise();

            const include = tagSet.TagSet.some(
              (t) => t.Key === "test-resource" && t.Value === "true"
            );

            return { bucket, include };
          })
        );

        return bucketsWithData.filter((b) => b.include).map((b) => b.bucket);
      });

  protected cleanResource = async (
    client: S3,
    resource: Bucket
  ): Promise<CleanResult> => {
    this.pagedOperation(
      (params) => client.listObjects(params),
      {
        Bucket: resource.Name,
      },
      (res) => res.Contents.map((o) => o.Key!)
    ).then(async (objects) => {
      for (const o of objects) {
        await client
          .deleteObjects({
            Bucket: resource.Name,
            Delete: {
              Objects: [{ Key: o }],
            },
          })
          .promise();
      }
    });

    return client
      .deleteBucket({ Bucket: resource.Name })
      .promise()
      .then(() => ({ id: resource.Name, status: "success" }));
  };

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): S3 =>
    new S3({
      ...options,
      credentials,
      region,
    });
}
