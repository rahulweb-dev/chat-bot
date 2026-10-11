import mongoose, { Schema, Model } from "mongoose";

// Atomic per-key sequence (e.g. "ticket:<companyId>"). $inc on a single document
// is atomic in MongoDB, so concurrent requests never get the same number.
export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);

export default Counter;
