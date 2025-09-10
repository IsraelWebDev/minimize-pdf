#!/bin/bash
set -e

# ------------------------------
# Usage:
# ./update_lambda_s3.sh <lambda-function-name> <s3-package-bucket> [lambda-folder]
# Example:
# ./update_lambda_s3.sh pdf-gen-LambdaFunction my-package-bucket ./lambda
# ------------------------------

lambda_name=$1
package_bucket=$2
lambda_dir=${3:-./lambda}
zip_file="lambda.zip"

if [ -z "$lambda_name" ] || [ -z "$package_bucket" ]; then
    echo "Usage: $0 <lambda-function-name> <s3-package-bucket> [lambda-folder]"
    exit 1
fi

echo "==== Step 1: Install production dependencies ===="
cd "$lambda_dir"
if [ -f package.json ]; then
    echo "Installing npm production dependencies..."
    npm ci --production
else
    echo "No package.json found, skipping npm install"
fi
cd - >/dev/null

echo "==== Step 2: Create ZIP package ===="
# Remove previous zip if exists
rm -f "$zip_file"
cd "$lambda_dir"
zip -r "../$zip_file" .
cd - >/dev/null

echo "==== Step 3: Upload ZIP to S3 ===="
aws s3 cp "$zip_file" "s3://$package_bucket/$zip_file"

echo "==== Step 4: Update Lambda function from S3 ===="
aws lambda update-function-code \
  --function-name "$lambda_name" \
  --s3-bucket "$package_bucket" \
  --s3-key "$zip_file"

echo "==== Lambda function '$lambda_name' updated successfully! ===="

