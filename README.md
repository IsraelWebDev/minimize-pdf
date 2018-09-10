# pdf-converter

An AWS Lambda function to convert a PDF file to PNG using Ghostscript. The function reads a PDF file from an S3 bucket, uses Ghostscript to convert the PDF to PNG, then writes the PNG file back to an S3 bucket. This function is triggered when a PDF file is places in an S3 bucket. 
