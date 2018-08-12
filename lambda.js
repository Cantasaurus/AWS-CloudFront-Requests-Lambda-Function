var AWS = require("aws-sdk");
const nodemailer = require("nodemailer");

//Lambda does support env variables surprisingly, maybe not surprisingly actually :D.
//https://docs.aws.amazon.com/lambda/latest/dg/env_variables.html
const emailPassword = process.env.EMAIL_PASSWORD;
const accessKeyId = process.env.AWS_CLIENT;
const secretAccessKey = process.env.AWS_SECRET;
const region = "us-east-1";

//Can also set region in Cloudwatch declaration.
AWS.config.update({
  accessKeyId,
  secretAccessKey,
  region
});

//Get the start and end time of yesterday as the lambda function is run on a cron job
//one minute into the day.
var start = new Date();
start.setDate(start.getDate() - 1);
start.setUTCHours(0,0,0,0);

var end = new Date();
end.setDate(end.getDate() - 1);
end.setUTCHours(23,59,59,999);

var cw = new AWS.CloudWatch({apiVersion: '2010-08-01'});

// 2018-08-05T04:00:00.000Z <- This is one of the possible date formats you can use.
//StartTime and EndTime can accept a date object as well which is what is used below.
//The AWS docs explain everything in detail.
var params = {
  StartTime: start,
  EndTime: end,
      MetricDataQueries: [
     {
       Id: 'm1',
       MetricStat: {
         Metric: {
           Dimensions: [
             {
               Name: 'DistributionId',
               Value: 'E3O91E3NCO4C64'
             },
             {
               Name: 'Region',
               Value: 'Global'
             },
           ],
           MetricName: 'Requests',
           Namespace: 'AWS/CloudFront'
         },
         Period: 86400,
         Stat: 'Sum',
         Unit: "None"
       },
     },
   ],
};

//Transporter object for nodemailer. Service can be any smtp server but gmail
//is extremely easy to setup if you already have an account as you can see.
//You do have to turn on the access for less secure apps setting in your gmail
//settings however. I also had to manually accept a prompt from Google after running
//a test of the function to accept that the AWS datacenter in VA was trying to access
//my account. All should be good afterwards.
var transporter = nodemailer.createTransport({
 service: 'gmail',
 auth: {
        user: 'dannycanter123@gmail.com',
        pass: emailPassword
    }
});

function metrics(){
  let startString = start.toUTCString();
  cw.getMetricData(params, (err, data) => {
    if (err) {
      console.log(`There was an error getting the CloudFront metrics.\n${err}`);
      //Simply change the from, to, subject, and html to your liking. My needs are fairly simple.
      const mailOptions = {
        from: 'dannycanter123@gmail.com',
        to: 'dannycanter123@gmail.com',
        subject: `CloudFront requests for ${startString}`,
        html: `<p>There was an error getting the CloudFront requests for <i>${startString}</i>.</p>`
      };

      //nodemailer sendMail method. Standard node callback with err first.
      transporter.sendMail(mailOptions, (err, info) => {
         if(err){
           console.log(err);
        }else{
          console.log("Succesfully sent the email.");
        }
      });

    }else{
      console.log("CloudFront metrics were successfully retrieved.");
      let amount = data.MetricDataResults[0].Values[0];
      if (data.MetricDataResults[0].Values.length === 0){
        amount = 0;
      }
      const mailOptions = {
        from: 'dannycanter123@gmail.com',
        to: 'dannycanter123@gmail.com',
        subject: `CloudFront requests for ${startString}`,
        html: `<p>The CloudFront requests for <i>${startString}</i> are: <b>${amount}</b></p>`
      };

      transporter.sendMail(mailOptions, (err, info) => {
         if(err){
           console.log(err);
        }else{
          console.log("Successfully sent the email.");
        }
      });
     }
  });
}

exports.handler = (events, context, callback) => {
  metrics();
  //No real error handling here. Could pass a callback to metrics function to grab whether an error
  //occurred anywhere in metrics and use it here but the logs in metrics should be enough for my use
  //case. This is what is displayed in the logs (as well as any console logs) when the function finishes
  //First parameter is an error object, and second is a success object.
  callback(null, "Function finished");
}
