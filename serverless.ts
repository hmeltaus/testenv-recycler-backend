import type { Serverless } from "serverless/aws";

const stage = "prod";
const reservationTableName = `reservation-${stage}`;
const clientTableName = `client-${stage}`;
const environmentTableName = `environment-${stage}`;
const processTableName = `process-${stage}`;

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
  plugins: [
    "serverless-webpack",
    "serverless-step-functions",
    "serverless-pseudo-parameters",
  ],
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
      PROCESS_TABLE: processTableName,
      FULFILL_STATE_MACHINE_ARN:
        "arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:fulfillReservations",
      CLEAN_STATE_MACHINE_ARN:
        "arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:cleanEnvironment",
    },
    iamRoleStatements: [
      {
        Effect: "Allow",
        Action: [
          "dynamodb:BatchWriteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:PutItem",
        ],
        Resource: [
          `arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${reservationTableName}`,
          `arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${clientTableName}`,
          `arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${environmentTableName}`,
          `arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${processTableName}`,
        ],
      },
      {
        Effect: "Allow",
        Action: ["sts:AssumeRole"],
        Resource: "*",
      },
      {
        Effect: "Allow",
        Action: ["states:StartExecution"],
        Resource: [
          "arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:fulfillReservations",
          "arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:cleanEnvironment",
        ],
      },
    ],
  },
  functions: {
    authorizer: {
      handler: "handler.authorize",
    },
    cleanReservations: {
      handler: "handler.cleanReservations",
      events: [{ schedule: "rate(30 minutes)" }],
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
    fulfillmentFulfillReservation: {
      handler: "handler.fulfillmentFulfillReservation",
      name: `recycler-${stage}-fulfill-reservation`,
    },
    cleanGetEnvironment: {
      handler: "handler.cleanGetEnvironment",
      name: `recycler-${stage}-clean-get-environment`,
    },
    cleanLoadResources: {
      handler: "handler.cleanLoadResources",
      name: `recycler-${stage}-clean-load-resources`,
    },
    cleanCleanResource: {
      handler: "handler.cleanCleanResource",
      name: `recycler-${stage}-clean-clean-resource`,
    },
  },
  stepFunctions: {
    stateMachines: {
      cleanEnvironment: {
        name: "cleanEnvironment",
        definition: {
          Comment: "Clean environment",
          StartAt: "getEnvironment",
          States: {
            getEnvironment: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["cleanGetEnvironment", "Arn"],
              },
              Next: "endOrLoadResources",
            },
            endOrLoadResources: {
              Type: "Choice",
              Choices: [
                {
                  Variable: "$.environmentStatus",
                  StringEquals: "dirty",
                  Next: "loadResources",
                },
              ],
              Default: "end",
            },
            end: {
              Type: "Succeed",
            },
            loadResources: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["cleanLoadResources", "Arn"],
              },
              Next: "cleanResource",
            },
            cleanResource: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["cleanCleanResource", "Arn"],
              },
              Next: "endOrContinueCleaning",
            },
            endOrContinueCleaning: {
              Type: "Choice",
              Choices: [
                {
                  Variable: "$.ready",
                  BooleanEquals: true,
                  Next: "end",
                },
              ],
              Default: "cleanResource",
            },
          },
        },
      },
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
              Next: "fulfillReservationOrEndProcess",
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: "endProcess",
                },
              ],
            },
            fulfillReservationOrEndProcess: {
              Type: "Choice",
              Choices: [
                {
                  Variable: "$.reservation",
                  IsPresent: true,
                  Next: "fulfillReservation",
                },
              ],
              Default: "endProcess",
            },
            fulfillReservation: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["fulfillmentFulfillReservation", "Arn"],
              },
              Next: "waitOrContinueProcess",
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: "endProcess",
                },
              ],
            },
            waitOrContinueProcess: {
              Type: "Choice",
              Choices: [
                {
                  Variable: "$.ready",
                  BooleanEquals: true,
                  Next: "getOldestPendingReservation",
                },
              ],
              Default: "wait",
            },
            wait: {
              Type: "Wait",
              Seconds: 5,
              Next: "getOldestPendingReservation",
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
            { AttributeName: "id", KeyType: "HASH" },
            { AttributeName: "type", KeyType: "RANGE" },
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
          TableName: processTableName,
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
