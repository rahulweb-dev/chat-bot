import NextAuth, { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { connectDB } from "./mongodb";
import User from "@/models/User";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();

        const user = await User.findOne({ email: credentials.email }).select("+password");
        if (!user || !user.password) return null;
        if (!user.isActive) throw new Error("Account is deactivated");
        if (user.companyId) {
          const { default: Company } = await import("@/models/Company");
          const company = await Company.findById(user.companyId);
          if (company?.isSuspended) throw new Error("Company account is suspended");
        }

        const isValid = await user.comparePassword(credentials.password as string);
        if (!isValid) return null;

        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId?.toString(),
          image: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await connectDB();
        const existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          await User.create({
            name: user.name ?? "Google User",
            email: user.email ?? "",
            googleId: account.providerAccountId,
            avatar: user.image ?? undefined,
            role: "COMPANY_ADMIN",
            isEmailVerified: true,
          });
        } else {
          if (!existingUser.isActive) return false;
          await User.findByIdAndUpdate(existingUser._id, {
            googleId: account.providerAccountId,
            lastLogin: new Date(),
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = ((user as { role?: string }).role as import("@/types").UserRole) ?? "AGENT";
        token.companyId = (user as { companyId?: string }).companyId;
      } else if (token.id) {
        await connectDB();
        const dbUser = await User.findById(token.id);
        if (dbUser) {
          token.role = dbUser.role;
          token.companyId = dbUser.companyId?.toString();
          token.name = dbUser.name;
          token.picture = dbUser.avatar;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as import("@/types").UserRole;
        session.user.companyId = token.companyId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
