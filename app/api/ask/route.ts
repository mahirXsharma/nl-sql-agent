import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/app/lib/prisma";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FORBIDDEN = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;

export async function POST(req: Request) {
    let sql = "";
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    // 1. Live schema introspection from Postgres
    const cols = await prisma.$queryRawUnsafe<
      { table_name: string; column_name: string; data_type: string }[]
    >(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name NOT IN ('_prisma_migrations', 'Chat')
      ORDER BY table_name, ordinal_position;
    `);

    const schemaText = cols
      .map((c) => `"${c.table_name}"."${c.column_name}" (${c.data_type})`)
      .join("\n");

    // 2. Ask Gemini to write Postgres SQL
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a PostgreSQL expert. Given this exact database schema:\n${schemaText}\n\nWrite a single read-only PostgreSQL SELECT query to answer: "${question}"\n\nRules:\n- Return ONLY the raw SQL query. No markdown, no backticks, no explanation.\n- Always double-quote PascalCase table names and camelCase column names (e.g. "Painting", "totalAmount", "createdAt").\n- Always add a sensible LIMIT (max 50) if no limit is implied.`,
    });

    sql = (response.text ?? "")
      .replace(/```sql|```/gi, "")
      .trim()
      .replace(/;+$/, "");

    // 3. Guardrail v0.1: hard-block anything that isn't a single SELECT
    if (!/^(SELECT|WITH)\b/i.test(sql) || FORBIDDEN.test(sql) || sql.includes(";")) {
      return NextResponse.json(
        { error: "Blocked by safety guardrail: only single read-only SELECT queries are allowed.", sql },
        { status: 403 }
      );
    }

    // 4. Run on Postgres & convert BigInt (from COUNT/SUM) so JSON.stringify doesn't blow up
    const rawRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
    const rows = JSON.parse(
      JSON.stringify(rawRows, (_, val) => (typeof val === "bigint" ? Number(val) : val))
    );

    return NextResponse.json({ sql, rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ error: message, sql }, { status: 500 });
  }
}