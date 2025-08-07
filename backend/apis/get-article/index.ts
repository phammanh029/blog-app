import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const slug = event.pathParameters?.slug;
  if (!slug) return { statusCode: 400, body: 'Missing slug' };

  const res = await ddb.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { slug: { S: slug } },
    })
  );
  if (!res.Item) return { statusCode: 404, body: 'Not found' };

  return {
    statusCode: 200,
    body: JSON.stringify(unmarshall(res.Item)),
  };
};
