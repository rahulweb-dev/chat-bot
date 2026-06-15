import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  role: "SUPER_ADMIN" | "COMPANY_ADMIN" | "MANAGER" | "TEAM_LEADER" | "AGENT" | "VIEWER";
  companyId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  googleId?: string;
  skills?: string[];
  languages?: string[];
  maxConcurrentChats: number;
  isOnline: boolean;
  lastSeen?: Date;
  timezone: string;
  notificationPreferences: {
    email: boolean;
    browser: boolean;
    newChat: boolean;
    newTicket: boolean;
    newLead: boolean;
    usageAlerts: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    avatar: { type: String },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "TEAM_LEADER", "AGENT", "VIEWER"],
      default: "AGENT",
    },
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    lastLogin: { type: Date },
    googleId: { type: String },
    skills: [{ type: String }],
    languages: [{ type: String, default: ["en"] }],
    maxConcurrentChats: { type: Number, default: 5 },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date },
    timezone: { type: String, default: "UTC" },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      browser: { type: Boolean, default: true },
      newChat: { type: Boolean, default: true },
      newTicket: { type: Boolean, default: true },
      newLead: { type: Boolean, default: true },
      usageAlerts: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ companyId: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ companyId: 1, role: 1 });

UserSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
