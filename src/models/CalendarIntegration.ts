import mongoose, { Schema, Document, Model } from "mongoose";

// A company's connected Google Calendar, used by chat bookings: busy times there
// hide booking slots, and each booking is added there as an event.
export interface ICalendarIntegration extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  provider: "GOOGLE";
  email?: string;
  calendarId: string;
  encryptedRefreshToken: string;
  enabled: boolean;
  connectedBy?: mongoose.Types.ObjectId;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarIntegrationSchema = new Schema<ICalendarIntegration>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    provider: { type: String, enum: ["GOOGLE"], default: "GOOGLE" },
    email: { type: String },
    calendarId: { type: String, default: "primary" },
    encryptedRefreshToken: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    connectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastError: { type: String },
  },
  { timestamps: true }
);

const CalendarIntegration: Model<ICalendarIntegration> =
  mongoose.models.CalendarIntegration || mongoose.model<ICalendarIntegration>("CalendarIntegration", CalendarIntegrationSchema);
export default CalendarIntegration;
