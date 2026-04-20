import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

function requireEnv(value: string | undefined, key: string) {
  if (!value) throw new Error(`MISSING_ENV:${key}`);
  return value;
}

const s3 = new S3Client({
  region: requireEnv(region, "AWS_REGION"),
  credentials: {
    accessKeyId: requireEnv(accessKeyId, "AWS_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv(secretAccessKey, "AWS_SECRET_ACCESS_KEY"),
  },
});

function sanitizeSegment(segment: string) {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadEmployeeDocumentToS3(args: {
  demoSessionId: string;
  employeeId: string;
  documentType: string;
  file: File;
}) {
  const targetBucket = requireEnv(bucket, "AWS_S3_BUCKET");
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

  return `https://${targetBucket}.s3.${requireEnv(region, "AWS_REGION")}.amazonaws.com/${objectKey}`;
}
