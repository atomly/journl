import { NextResponse } from "next/server";

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectUrl = new URL("/auth/error", requestUrl.origin);

  redirectUrl.search = requestUrl.search;

  return NextResponse.redirect(redirectUrl);
}
