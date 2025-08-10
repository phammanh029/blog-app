// api/create-article/index.ts

import { type APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { z } from 'zod';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;
const noneEmptyString = z.string().min(1);

// Define Zod schema
const ArticleSchema = z.object({
  slug: noneEmptyString,
  title: noneEmptyString,
  content: noneEmptyString,
  author: noneEmptyString,
  tags: z.array(noneEmptyString).min(1),
  // optional extras:
  status: z.enum(['published', 'draft']).default('published'),
});

const ArticleSchemaJsonSchema = noneEmptyString
  .transform((arg, ctx) => {
    try {
      return JSON.parse(arg);
    } catch (error) {
      ctx.addIssue('Invalid JSON format');
      return z.NEVER; // This will cause validation to fail
    }
  })
  .pipe(ArticleSchema);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!event.body) return { statusCode: 400, body: 'Missing request body' };

  // Zod validation
  const parsed = ArticleSchemaJsonSchema.safeParse(event.body);
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Validation failed',
        details: parsed.error.message,
      }),
    };
  }
  const { slug, title, content, author, tags, status } = parsed.data;
  const now = new Date().toISOString();

  // --- Single-table keys (Article item) ---
  // pk/sk for direct lookup
  // gsi1: list-all (newest first)
  // gsi2: list-by-author (newest first)
  const articleItem = {
    pk: `ARTICLE#${slug}`,
    sk: 'METADATA',
    gsi1pk: 'ARTICLE',
    gsi1sk: now,
    gsi2pk: `AUTHOR#${author}`,
    gsi2sk: now,

    slug,
    title,
    content,
    author,
    tags,
    status,
    createdAt: now,
    updatedAt: now,
  };

  // --- Tag index items (one per tag) ---
  // Enables efficient query by tag without a GSI:
  //   Query TABLE where pk="TAG#tag" ORDER BY sk DESC
  const tagItems = tags.map((tag) => ({
    pk: `TAG#${tag}`,
    sk: `${now}#${slug}`,
    slug,
    title,
    author,
    createdAt: now,
  }));

  try {
    await ddb.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE_NAME,
              Item: marshall(articleItem),
              // Enforce uniqueness on slug via the partition key
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          ...tagItems.map((ti) => ({
            Put: {
              TableName: TABLE_NAME,
              Item: marshall(ti),
            },
          })),
        ],
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Article created', slug }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err: any) {
    if (err.name === 'TransactionCanceledException') {
      return { statusCode: 409, body: 'Article with this slug already exists' };
    }
    console.error('Create article failed:', err);
    return { statusCode: 500, body: 'Failed to create article' };
  }
};
