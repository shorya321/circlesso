import { NextResponse } from "next/server";

// GET /api/circle/members — list Circle.so members with Auth0 status
// TODO: Implement in F008
export async function GET() {
  return NextResponse.json(
    { error: "Not implemented", feature: "F008" },
    { status: 501 }
  );
}
