import mongoose, { Schema, Document, Model } from "mongoose";

// An appointment / site visit booked by a visitor through the chatbot.
export interface IBooking extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  label: string;
  name: string;
  phone?: string;
  email?: string;
  startAt: Date;
  endAt: Date;
  status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  notes?: string;
  attribution?: import("@/lib/attribution").Attribution;
  reminderSentAt?: Date;
  googleEventId?: string; // event in the company's connected Google Calendar
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    label: { type: String, default: "appointment" },
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["BOOKED", "CANCELLED", "COMPLETED", "NO_SHOW"], default: "BOOKED" },
    notes: { type: String },
    attribution: { type: Schema.Types.Mixed },
    reminderSentAt: { type: Date },
    googleEventId: { type: String },
  },
  { timestamps: true }
);

BookingSchema.index({ companyId: 1, startAt: 1 });
BookingSchema.index({ status: 1, startAt: 1 });

const Booking: Model<IBooking> = mongoose.models.Booking || mongoose.model<IBooking>("Booking", BookingSchema);
export default Booking;
