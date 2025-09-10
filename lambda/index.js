const util = require('util');
const AWS = require('aws-sdk');
const gs = require('gs');
const fs = require('fs').promises;

const outputPrefix = process.env.PREFIX;
const outputType = process.env.TYPE;
const outputBucket = process.env.DESTINATION;

const s3 = new AWS.S3();

async function downloadPdf(inputBucket, inputKey) {
    console.log('Downloading ' + inputBucket + '/' + inputKey);

    const data = await s3.getObject({ Bucket: inputBucket, Key: inputKey }).promise();
    const outputFilename = '/tmp/input';
    await fs.writeFile(outputFilename, data.Body);
    return outputFilename;
}

async function minimizePdf(inputFilename, inputBucket, inputKey) {
    console.log('Minimizing ' + inputBucket + '/' + inputKey);

    const outputFilename = '/tmp/output';

    // Get input file size
    const inputStats = await fs.stat(inputFilename);
    const inputSize = inputStats.size;
    console.log(`Input file size: ${inputSize} bytes`);

    // Wrap the gs batch call in a Promise
    return new Promise((resolve, reject) => {
        gs().batch()
            .nopause()
            .option('-r150')
            .option('-dNoOutputFonts')
            .option('-dCompatibilityLevel=1.4')
            .option('-dColorImageResolution=150')
            .option('-dGrayImageResolution=150')
            .option('-dMonoImageResolution=150')
            .option('-dDownsampleColorImages=true')
            .option('-dDownsampleGrayImages=true')
            .option('-dDownsampleMonoImages=true')
            .executablePath('node_modules/lambda-ghostscript/bin/./gs')
            .device(outputType === 'png' ? 'png16m' : 'pdfwrite')
            .output(outputFilename)
            .input(inputFilename)
            .exec(async (err) => {
                if (err) return reject(err);

                try {
                    const stats = await fs.stat(outputFilename);
                    const outputSize = stats.size;

                    if (outputSize <= 4096) {
                        return reject(new Error('PDF may be password protected'));
                    }

                    console.log(`Output file size: ${outputSize} bytes`);
                    console.log(`Size difference: ${outputSize - inputSize} bytes (${((outputSize - inputSize) / inputSize * 100).toFixed(2)}%)`);

                    const data = await fs.readFile(outputFilename);
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            });
    });
}

async function uploadImage(data, inputKey) {
    const outputKey = outputPrefix + inputKey;
    console.log('Uploading ' + outputBucket + '/' + outputKey);

    await s3.putObject({
        Bucket: outputBucket,
        Key: outputKey,
        Body: data,
        ContentType: outputType === 'png' ? 'image/png' : 'application/pdf',
    }).promise();
}

exports.handler = async (event) => {
    try {
        console.log("Reading options from event:\n", util.inspect(event, { depth: 5 }));

        const inputBucket = event.Records[0].s3.bucket.name;
        if (inputBucket === outputBucket) {
            console.log('Beware of infinite loops when triggering and writing to the same bucket.');
        }

        const inputKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

        const inputFilename = await downloadPdf(inputBucket, inputKey);
        const data = await minimizePdf(inputFilename, inputBucket, inputKey);
        await uploadImage(data, inputKey);

        console.log('Successfully processed ' + inputBucket + '/' + inputKey);
        return { message: 'Success' };
    } catch (err) {
        console.error('Unable to process event:', err);
        throw err; // Lambda will mark this invocation as failed
    }
};

