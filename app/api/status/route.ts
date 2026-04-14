import { NextResponse } from "next/server";

// GET /api/status — provisioning status for all members
// TODO: Implement in F008
export async function GET() {
  return NextResponse.json(
    { error: "Not implemented", feature: "F008" },
    { status: 501 }
  );
}
