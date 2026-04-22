import { NextRequest } from "next/server";
import { createTemplateFromPrompt, patchTemplateFromPrompt } from "@/lib/template-authoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthorCreateRequest = {
  action: "create";
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  prompt: string;
  baseTemplateId?: string;
  previewOutDir?: string;
};

type AuthorPatchRequest = {
  action: "patch";
  id: string;
  name?: string;
  description?: string;
  version?: string;
  prompt: string;
  previewOutDir?: string;
};

export async function POST(request: NextRequest) {
  let body: AuthorCreateRequest | AuthorPatchRequest;

  try {
    body = (await request.json()) as AuthorCreateRequest | AuthorPatchRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body?.prompt || typeof body.prompt !== "string") {
    return Response.json({ error: "prompt is required." }, { status: 400 });
  }

  try {
    if (body.action === "create") {
      const result = await createTemplateFromPrompt(body);
      return Response.json(result);
    }

    if (body.action === "patch") {
      const result = await patchTemplateFromPrompt(body);
      return Response.json(result);
    }

    return Response.json({ error: 'action must be "create" or "patch".' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 400 });
  }
}
