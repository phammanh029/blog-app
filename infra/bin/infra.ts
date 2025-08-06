#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BlogStack } from '../lib/blog-stack';

const app = new cdk.App();
new BlogStack(app, 'BlogStack');
