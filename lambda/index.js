var async = require('async');
var util = require('util');
var AWS = require('aws-sdk');
var gs = require('gs');            
var fs = require('fs');

var outputPrefix = process.env.PREFIX;
var outputType = process.env.TYPE

var s3 = new AWS.S3();
 
exports.handler = function(event, context, callback) {

    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));

    var inputBucket = event.Records[0].s3.bucket.name;
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

        function convertToPng(inputFilename, next) {
            console.log('Converting ' + inputBucket + '/' + inputKey);

            var outputFilename = "/tmp/output";

            gs().batch()
            .nopause()
            .option('-r600') // DPI
            .executablePath('./bin/./gs')
            .device('png16m') // to PNG
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

            var inputBasename = inputKey.replace(/\\/g,'/').replace(/.*\//, '').split('.')[0];  
            var outputKey = outputPrefix + inputBasename + ".png"

            console.log('Uploading ' + inputBucket + '/' + outputKey);
            // Upload the image to S3 and make publicly accessible
            s3.putObject({ Bucket: inputBucket,
                           Key: outputKey, 
                           Body: data,
                           ContentType: "image/png"
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
