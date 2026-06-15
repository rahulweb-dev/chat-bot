import "next-auth";
import "next-auth/jwt";
import { UserRole } from "./index";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      companyId?: string;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    companyId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    companyId?: string;
  }
}
