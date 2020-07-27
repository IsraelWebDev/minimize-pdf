# pdf-minimizer

An AWS Lambda function to downsample a PDF file using Ghostscript. The function reads a PDF file from an S3 bucket, uses Ghostscript to minimize the PDF, then writes the PDF file back to an S3 bucket. This function is triggered when a PDF file is placed in an S3 bucket. 
