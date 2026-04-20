import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { uploadEmployeeDocumentToS3 } from "@/src/lib/s3";
import { DocumentType } from "@prisma/client";
import { apiError } from "@/src/lib/api-error";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);
    const { id } = await params;
    const docs = await prisma.document.findMany({
      where: {
        employeeId: id,
        employee: {
          demoSessionId: session.demoSessionId,
          ...(session.role === "SITE_SUPERVISOR"
            ? { siteAssignment: { site: { supervisorUserId: session.userId } } }
            : {}),
        },
      },
    });

    return Response.json(docs);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch documents", 400);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can verify documents");
    const { id } = await params;
    const form = await req.formData();
    const type = String(form.get("type") ?? "");
    const documentNumberRaw = form.get("documentNumber");
    const expiryDateRaw = form.get("expiryDate");
    const file = form.get("file");
    const deferOnly = String(form.get("deferOnly") ?? "") === "true";
    const deferRemarkRaw = form.get("deferRemark");
    const deferRemark =
      typeof deferRemarkRaw === "string" ? deferRemarkRaw.trim() : String(deferRemarkRaw ?? "").trim();

    if (!type) return apiError("Document type is required", 400);
    if (!(Object.values(DocumentType) as string[]).includes(type)) {
      return apiError("Invalid document type", 400);
    }

    const employee = await prisma.employee.findFirst({ where: { id, demoSessionId: session.demoSessionId }, select: { id: true } });
    if (!employee) return apiError("Employee not found", 404);

    const docType = type as DocumentType;
    const documentNumber =
      typeof documentNumberRaw === "string" && documentNumberRaw.trim() ? documentNumberRaw.trim() : null;
    const expiryDate =
      typeof expiryDateRaw === "string" && expiryDateRaw ? new Date(expiryDateRaw) : null;

    if (deferOnly) {
      if (deferRemark.length < 3) {
        return apiError("Please enter a remark (at least 3 characters) explaining why the upload is deferred.", 400);
      }

      const existing = await prisma.document.findFirst({
        where: { employeeId: id, type: docType },
        orderBy: { id: "desc" },
      });

      if (existing?.fileUrl && String(existing.fileUrl).trim().length > 0) {
        return apiError("This document is already uploaded; remove the file first to defer.", 400);
      }

      if (existing) {
        const doc = await prisma.document.update({
          where: { id: existing.id },
          data: {
            documentNumber,
            expiryDate,
            status: "PENDING",
            fileUrl: null,
            uploadedAt: null,
            uploadDeferredRemark: deferRemark,
          },
        });
        return Response.json(doc, { status: 200 });
      }

      const doc = await prisma.document.create({
        data: {
          employeeId: id,
          type: docType,
          status: "PENDING",
          documentNumber,
          expiryDate,
          fileUrl: null,
          uploadedAt: null,
          uploadDeferredRemark: deferRemark,
        },
      });
      return Response.json(doc, { status: 201 });
    }

    if (!(file instanceof File)) return apiError("Document file is required", 400);

    const fileUrl = await uploadEmployeeDocumentToS3({
      demoSessionId: session.demoSessionId,
      employeeId: employee.id,
      documentType: type,
      file,
    });

    const existing = await prisma.document.findFirst({
      where: { employeeId: id, type: docType },
      orderBy: { id: "desc" },
    });

    if (existing) {
      const doc = await prisma.document.update({
        where: { id: existing.id },
        data: {
          status: "UPLOADED",
          documentNumber,
          expiryDate,
          uploadedAt: new Date(),
          fileUrl,
          uploadDeferredRemark: null,
        },
      });
      return Response.json(doc, { status: 200 });
    }

    const doc = await prisma.document.create({
      data: {
        employeeId: id,
        type: docType,
        status: "UPLOADED",
        documentNumber,
        expiryDate,
        uploadedAt: new Date(),
        fileUrl,
        uploadDeferredRemark: null,
      },
    });

    return Response.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    if (error instanceof Error && error.message.startsWith("MISSING_ENV:")) {
      return apiError(`Missing server env: ${error.message.replace("MISSING_ENV:", "")}`, 500);
    }
    return apiError("Unable to create document", 400);
  }
}
