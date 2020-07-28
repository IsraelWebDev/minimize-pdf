# pdf-minimizer

An AWS Lambda function to downsample a PDF file using Ghostscript. The function reads a PDF file from a new S3 bucket, uses Ghostscript to minimize the PDF, then writes the PDF file to a different S3 bucket. This function is triggered when a PDF file is placed in an S3 bucket. 

**To install:**

    > cd lambda && npm install && cd ..

    > ./build.sh <region> <bucket to upload the code> <new stack name> <new input bucket name> <output bucket>```
