import type { Serverless } from "serverless/aws";

const stage = "prod";
const reservationTableName = `reservation-${stage}`;
const clientTableName = `client-${stage}`;
const environmentTableName = `environment-${stage}`;

const serverlessConfiguration: Serverless = {
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
  plugins: ["serverless-webpack"],
  provider: {
    stage,
    name: "aws",
    runtime: "nodejs12.x",
    region: "eu-west-1",
    apiGateway: {
      minimumCompressionSize: 1024,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      RESERVATION_TABLE: reservationTableName,
      CLIENT_TABLE: clientTableName,
      ENVIRONMENT_TABLE: environmentTableName,
    },
    iamRoleStatements: [
      {
        Effect: "Allow",
        Action: [
          "dynamodb:BatchWriteItem",
          "dynamodb:Query",
          "dynamodb:getItem",
          "dynamodb:UpdateItem",
        ],
        Resource: [
          `arn:aws:dynamodb:eu-west-1:091338645050:table/${reservationTableName}`,
          `arn:aws:dynamodb:eu-west-1:091338645050:table/${clientTableName}`,
          `arn:aws:dynamodb:eu-west-1:091338645050:table/${environmentTableName}`,
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
    },
  },
};

module.exports = serverlessConfiguration;
