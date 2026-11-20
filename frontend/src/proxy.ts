import { NextResponse, type NextRequest } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Event pages stream (their loading state shows at once), so a missing event
 * can't change the status code after the fact. Ids that can never exist are
 * answered with a real 404 here, before anything streams.
 */
export function proxy(req: NextRequest) {
  const id = req.nextUrl.pathname.split("/")[2] ?? "";
  if (!UUID.test(id)) {
    return NextResponse.rewrite(new URL("/_missing", req.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/events/:id"] };
