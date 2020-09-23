import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { InternetGateway } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";

export class IgwCleaner extends AwsCleaner<EC2, InternetGateway> {
  static readonly resourceType = "Igw";
  readonly resourceType = IgwCleaner.resourceType;
  readonly depends = [];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (
    client: EC2
  ): Promise<InternetGateway[]> =>
    this.pagedOperation(
      (params) => client.describeInternetGateways(params),
      {},
      (response) => response.InternetGateways!
    );

  protected cleanResource = async (
    client: EC2,
    resource: InternetGateway
  ): Promise<CleanResult> => {
    console.log(`About to clean IGW:\n\n${JSON.stringify(resource, null, 2)}`);

    const attached = resource.Attachments.filter(
      (a) => a.State === "available"
    );
    if (attached.length > 0) {
      console.log(
        `Internet gateway ${resource.InternetGatewayId} has ${attached.length} attached VPCs`
      );
      await Promise.all(
        attached.map(async (a) => {
          console.log(
            `Detach VPC ${a.VpcId} from internet gateway ${resource.InternetGatewayId}`
          );
          return client
            .detachInternetGateway({
              InternetGatewayId: resource.InternetGatewayId,
              VpcId: a.VpcId,
            })
            .promise();
        })
      );
      return { status: "retry", id: resource.InternetGatewayId };
    }

    return client
      .deleteInternetGateway({
        InternetGatewayId: resource.InternetGatewayId,
      })
      .promise()
      .then(() => ({ id: resource.InternetGatewayId, status: "success" }));
  };

  protected refreshResource = async (
    client: EC2,
    resource: InternetGateway
  ): Promise<InternetGateway | undefined> =>
    client
      .describeInternetGateways({
        InternetGatewayIds: [resource.InternetGatewayId],
      })
      .promise()
      .then((res) =>
        res.InternetGateways.length > 0 ? res.InternetGateways[0] : undefined
      );

  protected createClient = (
    credentials: Credentials,
    region: string,
    options: ConfigurationOptions
  ): EC2 =>
    new EC2({
      ...options,
      credentials,
      region,
    });
}
