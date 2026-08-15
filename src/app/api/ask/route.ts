import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/query-engine";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { response } = await requireApiUser("dashboard");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "A 'question' string is required." }, { status: 400 });
  }
  const answer = await answerQuestion(question);
  return NextResponse.json(answer);
}
