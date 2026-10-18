import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

const ROLE_HOME: Record<Role, string> = {
  HOMEOWNER: "/dashboard",
  BUILDER: "/builder/projects",
  ADMIN: "/admin/builders",
};

/** Route prefix → roles allowed. Server code re-checks roles on every page and mutation. */
const RULES: Array<[RegExp, Role[]]> = [
  [/^\/admin(\/|$)/, ["ADMIN"]],
  [/^\/builder(\/|$)/, ["BUILDER"]],
  [/^\/(dashboard|projects)(\/|$)/, ["HOMEOWNER"]],
  [/^\/(bids|notifications)(\/|$)/, ["HOMEOWNER", "BUILDER", "ADMIN"]],
];

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;
    const rule = RULES.find(([re]) => re.test(path));
    if (rule && role && !rule[1].includes(role)) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: "/login" },
  },
);

export const config = {
  matcher: ["/admin/:path*", "/builder/:path*", "/dashboard/:path*", "/projects/:path*", "/bids/:path*", "/notifications/:path*"],
};
