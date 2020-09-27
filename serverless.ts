import type { Serverless } from "serverless/aws";

const stage = "prod";
const reservationTableName = `reservation-${stage}`;
const userTableName = `user-${stage}`;
const processTableName = `process-${stage}`;
const accountTableName = `account-${stage}`;
const jwtSecretName = `/testenv-recycler-backend-${stage}/jwt-secret`;

const serverlessConfiguration: Serverless | any = {
  service: {
    name: "testenv-recycler-backend",
  },
  frameworkVersion: "2",
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
      USER_TABLE: userTableName,
      ACCOUNT_TABLE: accountTableName,
      PROCESS_TABLE: processTableName,
      FULFILL_RESERVATIONS_STATE_MACHINE_ARN:
        "arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:FulfillReservations",
      CLEAN_ACCOUNT_STATE_MACHINE_ARN:
        "arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:CleanAccount",
      JWT_SECRET_NAME: jwtSecretName,
      EXECUTION_ROLE_ARN: { "Fn::GetAtt": ["ExecutionRole", "Arn"] },
    },
    iamRoleStatements: [
      {
        Sid: "DynamoDB",
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
          `arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${userTableName}`,
          `arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${accountTableName}`,
          `arn:aws:dynamodb:#{AWS::Region}:#{AWS::AccountId}:table/${processTableName}`,
        ],
      },
      {
        Sid: "STS",
        Effect: "Allow",
        Action: ["sts:AssumeRole"],
        Resource: "*",
      },
      {
        Sid: "SecretManager",
        Effect: "Allow",
        Action: ["secretsmanager:GetSecretValue"],
        Resource: `arn:aws:secretsmanager:#{AWS::Region}:#{AWS::AccountId}:secret:/testenv-recycler-backend-${stage}/*`,
      },
      {
        Sid: "StepFunctions",
        Effect: "Allow",
        Action: ["states:StartExecution"],
        Resource: [
          "arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:FulfillReservations",
          "arn:aws:states:#{AWS::Region}:#{AWS::AccountId}:stateMachine:CleanAccount",
        ],
      },
    ],
  },
  functions: {
    authorizer: {
      handler: "handler.authorize",
    },
    cleanReservations: {
      handler: "handler.scheduledCleanReservations",
      events: [{ schedule: "rate(5 minutes)" }],
    },
    fulfillReservations: {
      handler: "handler.scheduledFulfillReservations",
      events: [{ schedule: "rate(5 minutes)" }],
    },
    scheduledCleanDanglingAccount: {
      handler: "handler.scheduledCleanDanglingAccount",
      events: [{ schedule: "rate(10 minutes)" }],
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
    login: {
      handler: "handler.login",
      events: [
        {
          http: {
            method: "POST",
            path: "login",
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
    cleanGetAccount: {
      handler: "handler.cleanGetAccount",
      name: `recycler-${stage}-clean-get-account`,
    },
    cleanLoadResources: {
      handler: "handler.cleanLoadResources",
      name: `recycler-${stage}-clean-load-resources`,
    },
    cleanCleanResource: {
      handler: "handler.cleanCleanResource",
      name: `recycler-${stage}-clean-clean-resource`,
      timeout: 60,
    },
  },
  stepFunctions: {
    stateMachines: {
      CleanAccount: {
        name: "CleanAccount",
        definition: {
          Comment: "Clean account",
          StartAt: "getAccount",
          States: {
            getAccount: {
              Type: "Task",
              Resource: {
                "Fn::GetAtt": ["cleanGetAccount", "Arn"],
              },
              Next: "endOrLoadResources",
            },
            endOrLoadResources: {
              Type: "Choice",
              Choices: [
                {
                  Variable: "$.accountStatus",
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
      FulfillReservations: {
        name: "FulfillReservations",
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
      UserTable: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: userTableName,
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
          KeySchema: [{ AttributeName: "username", KeyType: "HASH" }],
          AttributeDefinitions: [
            {
              AttributeName: "username",
              AttributeType: "S",
            },
          ],
        },
      },
      AccountTable: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: accountTableName,
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
      ProcessTable: {
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
      JwtSecret: {
        Type: "AWS::SecretsManager::Secret",
        Properties: {
          Description: "JWT secret",
          Name: jwtSecretName,
          GenerateSecretString: {
            PasswordLength: 32,
            ExcludePunctuation: true,
          },
        },
      },
      ExecutionRole: {
        Type: "AWS::IAM::Role",
        Properties: {
          AssumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  AWS: "#{AWS::AccountId}",
                },
                Action: ["sts:AssumeRole"],
              },
            ],
          },
          Policies: [
            {
              PolicyName: "ExecutionRolePolicy",
              PolicyDocument: {
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Action: "sts:AssumeRole",
                    Resource: "*",
                  },
                ],
              },
            },
          ],
        },
      },
    },
  },
};

module.exports = serverlessConfiguration;
