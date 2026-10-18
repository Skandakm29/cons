import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    role: Role;
  }
  interface Session {
    user: { id: string; name: string; role: Role };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
  }
}
