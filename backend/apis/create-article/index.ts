// api/create-article/index.ts

import { type APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

// Define Zod schema
const ArticleSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  author: z.string().min(1),
  tags: z.array(z.string()).min(1),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) return { statusCode: 400, body: 'Missing request body' };
  let data: unknown;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Zod validation
  const parsed = ArticleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Validation failed', details: parsed.error.errors }),
    };
  }
  const { slug, title, content, author, tags } = parsed.data;

  try {
    await ddb.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({
          slug,
          title,
          content,
          author,
          tags,
          createdAt: new Date().toISOString(),
        }),
        ConditionExpression: 'attribute_not_exists(slug)', // Enforce uniqueness
      })
    );
    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Article created', slug }),
    };
  } catch (err: any) {
    if (err.name === "ConditionalCheckFailedException") {
      return { statusCode: 409, body: 'Article with this slug already exists' };
    }
    return { statusCode: 500, body: 'Failed to create article' };
  }
};
