import { NextResponse } from "next/server";

// POST /api/provision/migrate — migrate existing Circle.so member to Auth0
// TODO: Implement in F010
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", feature: "F010" },
    { status: 501 }
  );
}
