import { NextResponse } from "next/server";

// POST /api/provision/create — create new member in Circle.so + Auth0
// TODO: Implement in F011
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", feature: "F011" },
    { status: 501 }
  );
}
