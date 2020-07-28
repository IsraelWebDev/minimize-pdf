var async = require('async');
var util = require('util');
var AWS = require('aws-sdk');
var gs = require('gs');            
var fs = require('fs');

var outputPrefix = process.env.PREFIX;
var outputType = process.env.TYPE;
var outputBucket = process.env.DESTINATION;

var s3 = new AWS.S3();
 
exports.handler = function(event, context, callback) {

    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));

    var inputBucket = event.Records[0].s3.bucket.name;
    if(inputBucket == outputBucket)
        console.log('Beware of infinite loops when triggering and writing to the same bucket. See https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html');
 
    // Object key may have spaces or unicode non-ASCII characters.
    var inputKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));

    async.waterfall([

        function downloadPdf(next) {
            console.log('Downloading ' + inputBucket + '/' + inputKey);

            // Download the PDF locally for conversio
            s3.getObject({ Bucket: inputBucket,
                           Key: inputKey
                         }, function(err, data) {  
                if (err) {
                    next(err);   
                } else {
                    var outputFilename = "/tmp/input";
                    fs.writeFile(outputFilename, data.Body, function(err) {
                        if(err) {
                            next(err);
                        } else {
                            next(null, outputFilename);
                        }
                    }); 
                }
            });
        },

        function minimizePdf(inputFilename, next) {
            console.log('Minimizing ' + inputBucket + '/' + inputKey);

            var outputFilename = "/tmp/output";

            gs().batch()
            .nopause()
            .option('-r150') // DPI
            .option('-dNoOutputFonts') 
            .option('-dColorImageResolution=150') 
            .option('-dGrayImageResolution=150') 
            .option('-dMonoImageResolution=150') 
            .option('-dDownsampleColorImages=true') 
            .option('-dDownsampleGrayImages=true')
            .option('-dDownsampleMonoImages=true') 
            .executablePath('node_modules/lambda-ghostscript/bin/./gs')
            .device(outputType=='png'?'png16m':'pdfwrite') // to PNG/PDF
            .output(outputFilename)
            .input(inputFilename)
            .exec(function (err, stdout, stderr) {
                if (!err) {
                    fs.readFile(outputFilename, function (err, data) {
                        if (err) { 
                            next(err); 
                        } else {
                            next(null, data);
                        }
                    });
                } else {
                    next(err)
                }
            });
        },

        function uploadImage(data, next) {

            //var inputBasename = inputKey.replace(/\\/g,'/').replace(/.*\//, '').split('.')[0];  
            var outputKey = outputPrefix + inputKey;

            console.log('Uploading ' + outputBucket + '/' + outputKey);
            // Upload the image to S3 and make publicly accessible
            s3.putObject({ Bucket: outputBucket,
                           Key: outputKey, 
                           Body: data,
                           ContentType: (outputType=='png'?'image/png':'application/pdf')
                         }, function(err, response) {
                if (err) {
                    next(err);
                } else {
                    next(null);
                }
            });
        }], 

        function (err) {
            if (err) {
                console.error(
                    'Unable to process ' + inputBucket + '/' + inputKey +
                    ' due to an error: ' + err
                );
            } else {
                console.log(
                    'Successfully processed ' + inputBucket + '/' + inputKey 
                );
            }
            callback(null, "message");
        }
    );
};
