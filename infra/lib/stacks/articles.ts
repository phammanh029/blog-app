import { NestedStack, NestedStackProps, RemovalPolicy } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { DeploymentEnv } from "../env";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";

export interface ArticlesStackProps extends NestedStackProps {
  tableName: string;
  environment: DeploymentEnv;
}

export class ArticlesStack extends NestedStack {
  constructor(scope: Construct, id: string, props: ArticlesStackProps) {
    super(scope, id, props);

    // S3 bucket for assets
    const assetsBucket = new Bucket(this, `ArticlesStaticBucket-${props.environment}`, {
      publicReadAccess: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB table for articles
    const table = new Table(this, `ArticlesTable-${props.environment}`, {
      partitionKey: { name: 'slug', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.environment !== 'prod' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });
  }
}
