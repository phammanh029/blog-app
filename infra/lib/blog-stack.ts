import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';

export class BlogStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for static website
    const siteBucket = new Bucket(this, 'BlogSiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB table for blogs
    const table = new Table(this, 'BlogTable', {
      partitionKey: { name: 'slug', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda API (Node runtime)
    const apiLambda = new DockerImageFunction(this, 'BlogApiFunction', {
      code: cdk.aws_lambda.DockerImageCode.fromImageAsset('../api'), // build context
      environment: {
        TABLE_NAME: table.tableName,
        REGION: this.region,
      },
      timeout: cdk.Duration.seconds(15),
    });
    table.grantReadWriteData(apiLambda);

    // API Gateway
    const api = new LambdaRestApi(this, 'BlogApi', {
      handler: apiLambda,
      proxy: false,
      restApiName: "BlogApi",
      deployOptions: { stageName: "prod" },
    });

    // /blogs resource
    const blogs = api.root.addResource('blogs');
    blogs.addMethod('GET');   // list blogs
    blogs.addMethod('POST');  // create blog
  }
}
