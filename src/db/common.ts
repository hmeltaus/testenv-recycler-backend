import { DynamoDB } from "aws-sdk";

export const dynamo = new DynamoDB.DocumentClient({
  region: process.env.AWS_REGION,
});
