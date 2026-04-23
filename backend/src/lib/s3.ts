import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requireEnv(value: string | undefined, key: string) {
  if (!value) throw new Error(`MISSING_ENV:${key}`);
  return value;
}

function getAwsConfig() {
  return {
    region: requireEnv(process.env.AWS_REGION, "AWS_REGION"),
    bucket: requireEnv(process.env.AWS_S3_BUCKET, "AWS_S3_BUCKET"),
    accessKeyId: requireEnv(process.env.AWS_ACCESS_KEY_ID, "AWS_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv(process.env.AWS_SECRET_ACCESS_KEY, "AWS_SECRET_ACCESS_KEY"),
  };
}

function getS3Client(config: { region: string; accessKeyId: string; secretAccessKey: string }) {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function sanitizeSegment(segment: string) {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadEmployeeDocumentToS3(args: {
  demoSessionId: string;
  employeeId: string;
  documentType: string;
  file: File;
}) {
  const awsConfig = getAwsConfig();
  const s3 = getS3Client(awsConfig);
  const targetBucket = awsConfig.bucket;
  const extension = args.file.name.includes(".") ? args.file.name.slice(args.file.name.lastIndexOf(".")) : "";
  const objectKey = [
    "hrms",
    sanitizeSegment(args.demoSessionId),
    sanitizeSegment(args.employeeId),
    sanitizeSegment(args.documentType),
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${sanitizeSegment(extension)}`,
  ].join("/");

  const bytes = Buffer.from(await args.file.arrayBuffer());
  await s3.send(
    new PutObjectCommand({
      Bucket: targetBucket,
      Key: objectKey,
      Body: bytes,
      ContentType: args.file.type || "application/octet-stream",
      ACL: "private",
    }),
  );

  return `https://${targetBucket}.s3.${awsConfig.region}.amazonaws.com/${objectKey}`;
}
