import type { Serverless } from "serverless/aws";

const stage = "prod";
const reservationTableName = `reservation-${stage}`;
const clientTableName = `client-${stage}`;
const environmentTableName = `environment-${stage}`;
const fulfillmentTableName = `fulfillment-${stage}`;

const serverlessConfiguration: Serverless | any = {
  service: {
    name: "testenv-recycler-backend",
  },
  frameworkVersion: "1",
  custom: {
    webpack: {
      webpackConfig: "./webpack.config.js",
      includeModules: true,
    },
  },
  plugins: ["serverless-webpack", "serverless-step-functions"],
  provider: {
    stage,
    name: "aws",
    runtime: "nodejs12.x",
    region: "eu-west-1",
    versionFunctions: false,
    apiGateway: {
      minimumCompressionSize: 1024,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      RESERVATION_TABLE: reservationTableName,
      CLIENT_TABLE: clientTableName,
      ENVIRONMENT_TABLE: environmentTableName,
      FULFILLMENT_TABLE: fulfillmentTableName,
      FULFILLMENT_ID: stage,
    },
    iamRoleStatements: [
      {
        Effect: "Allow",
        Action: [
          "dynamodb:BatchWriteItem",
          "dynamodb:Query",
          "dynamodb:getItem",
          "dynamodb:UpdateItem",
          "dynamodb:PutItem",
        ],
        Resource: [
          `arn:aws:dynamodb:eu-west-1:091338645050:table/${reservationTableName}`,
          `arn:aws:dynamodb:eu-west-1:091338645050:table/${clientTableName}`,
          `arn:aws:dynamodb:eu-west-1:091338645050:table/${environmentTableName}`,
          `arn:aws:dynamodb:eu-west-1:091338645050:table/${fulfillmentTableName}`,
        ],
      },
    ],
  },
  functions: {
    authorizer: {
      handler: "handler.authorize",
    },
    create: {
      handler: "handler.create",
      events: [
        {
          http: {
            method: "post",
            path: "reservations",
            authorizer: {
              name: "authorizer",
              resultTtlInSeconds: 0,
            },
          },
        },
      ],
    },
    get: {
      handler: "handler.get",
      events: [
        {
          http: {
            method: "get",
            path: "reservations/{id}",
            authorizer: {
              name: "authorizer",
              resultTtlInSeconds: 0,
            },
          },
        },
      ],
    },
    remove: {
      handler: "handler.remove",
      events: [
        {
          http: {
            method: "delete",
            path: "reservations/{id}",
            authorizer: {
              name: "authorizer",
              resultTtlInSeconds: 0,
            },
          },
        },
      ],
    },
    fulfillmentGetProcessStatus: {
      handler: "handler.fulfillmentGetProcessStatus",
      name: `recycler-${stage}-get-process-status`,
    },
    fulfillmentGetOldestPendingReservation: {
      handler: "handler.fulfillmentGetOldestPendingReservation",
      name: `recycler-${stage}-get-oldest-pending-reservation`,
    },
    fulfillmentEndProcess: {
      handler: "handler.fulfillmentEndProcess",
      name: `recycler-${stage}-end-process`,
    },
    fulfillmentStartProcess: {
      handler: "handler.fulfillmentStartProcess",
      name: `recycler-${stage}-start-process`,
    },
  },
  stepFunctions: {
    stateMachines: {
      fulfillReservations: {
        name: "fulfillReservations",
        definition: {
          Comment: "Fulfill reservations",
          StartAt: "getProcessStatus",
          States: {
            getProcessStatus: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["fulfillmentGetProcessStatus", "Arn"],
              },
              Next: "startOrCancelProcess",
            },
            startOrCancelProcess: {
              Type: "Choice",
              Choices: [
                {
                  Variable: "$.running",
                  BooleanEquals: false,
                  Next: "startProcess",
                },
              ],
              Default: "cancelProcess",
            },
            cancelProcess: {
              Type: "Succeed",
            },
            startProcess: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["fulfillmentStartProcess", "Arn"],
              },
              Next: "getOldestPendingReservation",
            },
            getOldestPendingReservation: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["fulfillmentGetOldestPendingReservation", "Arn"],
              },
              Next: "beginReservationFulfillmentOrEndProcess",
            },
            beginReservationFulfillmentOrEndProcess: {
              Type: "Choice",
              Choices: [
                {
                  Variable: "$.reservation",
                  IsPresent: true,
                  Next: "endProcess",
                },
              ],
              Default: "endProcess",
            },
            endProcess: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["fulfillmentEndProcess", "Arn"],
              },
              End: true,
            },
          },
        },
      },
    },
  },
  resources: {
    Resources: {
      ReservationTable: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: reservationTableName,
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
          KeySchema: [
            { AttributeName: "id", KeyType: "HASH" },
            { AttributeName: "slot", KeyType: "RANGE" },
          ],
          AttributeDefinitions: [
            {
              AttributeName: "id",
              AttributeType: "S",
            },
            {
              AttributeName: "slot",
              AttributeType: "S",
            },
          ],
        },
      },
      ClientTable: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: clientTableName,
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
          KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
          AttributeDefinitions: [
            {
              AttributeName: "id",
              AttributeType: "S",
            },
          ],
        },
      },
      EnvironmentTable: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: environmentTableName,
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
          KeySchema: [
            { AttributeName: "type", KeyType: "HASH" },
            { AttributeName: "id", KeyType: "RANGE" },
          ],
          AttributeDefinitions: [
            {
              AttributeName: "id",
              AttributeType: "S",
            },
            {
              AttributeName: "type",
              AttributeType: "S",
            },
          ],
        },
      },

      FulfillmentTable: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: fulfillmentTableName,
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
          KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
          AttributeDefinitions: [
            {
              AttributeName: "id",
              AttributeType: "S",
            },
          ],
        },
      },
    },
  },
};

module.exports = serverlessConfiguration;
