#!/bin/bash
aws_region=$1
package_bucket=$2
stack_name=$3
input_bucket=$4
output_bucket=$5

aws --region $aws_region cloudformation package --template-file template.yaml --s3-bucket $package_bucket --output-template-file package.yaml
aws --region $aws_region cloudformation deploy --template-file package.yaml --stack-name $stack_name --capabilities CAPABILITY_IAM --parameter-overrides InputBucketName=$input_bucket OutputBucketName=$output_bucket


