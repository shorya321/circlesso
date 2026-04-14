import { NextResponse } from "next/server";

// GET /api/circle/access-groups — list Circle.so access groups
// TODO: Implement in F009
export async function GET() {
  return NextResponse.json(
    { error: "Not implemented", feature: "F009" },
    { status: 501 }
  );
}
