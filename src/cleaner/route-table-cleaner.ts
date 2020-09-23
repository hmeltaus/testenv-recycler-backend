import { CredentialProviderChain, Credentials, EC2 } from "aws-sdk";
import { RouteTable } from "aws-sdk/clients/ec2";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { AwsCleaner, CleanResult } from "./aws-cleaner";
import { SubnetCleaner } from "./subnet-cleaner";

export class RouteTableCleaner extends AwsCleaner<EC2, RouteTable> {
  static readonly resourceType = "RouteTable";
  readonly resourceType = RouteTableCleaner.resourceType;
  readonly depends = [SubnetCleaner.resourceType];

  constructor(credentialProvider: CredentialProviderChain, regions: string[]) {
    super(credentialProvider, regions);
  }

  protected getResourcesToClean = async (client: EC2): Promise<RouteTable[]> =>
    this.pagedOperation(
      (params) => client.describeRouteTables(params),
      {},
      (response) => response.RouteTables!
    );

  protected cleanResource = async (
    client: EC2,
    resource: RouteTable
  ): Promise<CleanResult> =>
    client
      .deleteRouteTable({ RouteTableId: resource.RouteTableId })
      .promise()
      .then(() => ({ id: resource.RouteTableId, status: "success" }));
  // {
  // const associated = resource.Associations.filter(
  //   (a) => a.AssociationState.State === "associated"
  // );
  // const c = await this.getClient(account, region);
  //
  // if (associated.length > 0) {
  //   console.log(`Route table ${resource.RouteTableId} has associations`);
  //   await Promise.all(
  //     associated.map(async (a) =>
  //       c.disassociateRouteTable({ AssociationId: a.RouteTableAssociationId })
  //     )
  //   );
  //
  //   return { status: "retry", id: resource.RouteTableId };
  // }
  //
  //
  //
  //   return c
  //     .deleteRouteTable({ RouteTableId: resource.RouteTableId })
  //     .promise()
  //     .then(() => ({ id: resource.RouteTableId, status: "success" }));
  // };

  // protected refreshResource = async (
  //   account: Account,
  //   region: string,
  //   resource: RouteTable
  // ): Promise<RouteTable | undefined> =>
  //   this.withClientPromise(
  //     account,
  //     region,
  //     (c) => c.describeRouteTables({ RouteTableIds: [resource.RouteTableId] }),
  //     (result) =>
  //       result.RouteTables.length > 0 ? result.RouteTables[0] : undefined
  //   );

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
