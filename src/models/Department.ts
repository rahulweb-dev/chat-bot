import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDepartment extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  managerId?: mongoose.Types.ObjectId;
  agentIds: mongoose.Types.ObjectId[];
  skills?: string[];
  languages?: string[];
  isActive: boolean;
  assignmentStrategy: string;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    color: { type: String, default: "#6366f1" },
    icon: { type: String },
    managerId: { type: Schema.Types.ObjectId, ref: "User" },
    agentIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    skills: [{ type: String }],
    languages: [{ type: String }],
    isActive: { type: Boolean, default: true },
    assignmentStrategy: { type: String, default: "ROUND_ROBIN" },
  },
  { timestamps: true }
);

DepartmentSchema.index({ companyId: 1 });
DepartmentSchema.index({ companyId: 1, name: 1 }, { unique: true });

const Department: Model<IDepartment> =
  mongoose.models.Department || mongoose.model<IDepartment>("Department", DepartmentSchema);
export default Department;
