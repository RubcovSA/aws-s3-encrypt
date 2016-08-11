import awsSdk from 'aws-sdk';

let logArr = [];
let log = (...args) => {
  let str = args.join('');
  logArr.push((new Date()).toLocaleTimeString() + ':  ' + str);
  sails.log.silly(str);
};

function putLogToS3() {
  s3.putObject({
    Bucket: env.PSA_S3_BUCKET_SSE_KMS_ENCRYPTED,
    SSEKMSKeyId: env.KMS_KEY_ID,
    ServerSideEncryption: 'aws:kms',
    Key: env.NAME_LOG_FILE || `logMigration${(new Date()).getTime()}.txt`,
    Body: logArr.join('\n')
  }, (err, data) => {
    if(err) return log(err);
    log(data);
  })
}

const {env} = process;
if (env.PSA_S3_DYNAMIC_KEYS === 'true') {
  awsSdk.config.update({region: env.EC2_REGION});
  awsSdk.config.credentials = new awsSdk.EC2MetadataCredentials();
} else {
  awsSdk.config.update({
    accessKeyId: env.PSA_S3_KEY,
    secretAccessKey: env.PSA_S3_SECRET,
    region: env.EC2_REGION
  });
}

let s3 = new awsSdk.S3({
  signatureVersion: 'v4', params: {
    Bucket: env.PSA_S3_BUCKET_BACKUP_OLD,
  }
});

function getParams(Key) {
  return {
    Bucket: env.PSA_S3_BUCKET_SSE_KMS_ENCRYPTED,
    CopySource: encodeURIComponent(`${env.PSA_S3_BUCKET_BACKUP_OLD}/${Key}`),
    Key,
    MetadataDirective: 'COPY',
    SSEKMSKeyId: env.KMS_KEY_ID,
    ServerSideEncryption: 'aws:kms'
  }
}

let arr = 0;
let countCopied = 0;
let countFailed = 0;
const delta = Number.parseInt(env.CONCURRENT_PUT_REQUEST) || 100;

function copyToAnotherS3(objects) {
  return new Promise((resolve, reject) => {

    function batchCopy(index) {
      let processes = [];
      for (let j = 0; j < delta; j++) {
        let i = index + j;
        processes.push(new Promise((res, rej) => {
          if (i >= objects.length) return res();

          let { Key } = objects[i];
          s3.copyObject(getParams(Key), (err, data) => {
            log('file : ', Key);
            if (err) {
              log(err);
              countFailed += 1;
              log('Current failed count: ', countFailed);
              // rej();
            } else {
              countCopied += 1;
              log('Current copied count: ', countCopied);
            }
            res();
          });
        }))
      }

      function next() {
        if (index >= objects.length) return resolve();
        log('All resolve it has to : ', arr + index + delta - countFailed);
        batchCopy(index + delta);
      }

      Promise.all(processes).then(next).catch(next);
    }

    batchCopy(0);
  });
}


let Migration = {
  run() {
    function finalize(err) {
      if (err) log('ERROR : ', err);
      else log('number of objects :', arr);

      putLogToS3();
    }

    function appendResult(err, data) {
      if (err) return finalize(err);
      copyToAnotherS3(data.Contents).then(() => {
        arr += data.Contents.length;
        log('already recieved objects : ', arr);
        let params = {
          Marker: data.Contents[data.Contents.length - 1].Key
        };
        log('data.IsTruncated ', data.IsTruncated);

        if (data.IsTruncated) {
          log('Marker ', data.Contents[data.Contents.length - 1].Key);
          s3.listObjects(params, appendResult);
        }
        else finalize();
      }).catch(err => finalize(err));
    }

    s3.listObjects(appendResult);
  }
};

env.DO_ENCRIPTION_MIGRATION === 'true' && env.PSA_S3_BUCKET_SSE_KMS_ENCRYPTED && Migration.run();

//module.exports = Migration;


