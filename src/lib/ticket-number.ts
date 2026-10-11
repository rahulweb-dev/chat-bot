import Counter from "@/models/Counter";
import Ticket from "@/models/Ticket";

// Replaces countDocuments()+1, which handed two simultaneous tickets the same
// number (and the unique index then rejected the second ticket outright), and
// reused numbers after a ticket was deleted.
export async function nextTicketNumber(companyId: string): Promise<string> {
  const key = `ticket:${companyId}`;
  let counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true });

  if (!counter) {
    // First ticket since this counter was introduced: continue from the highest
    // existing number so we never collide with tickets created the old way.
    const last = await Ticket.findOne({ companyId }).sort({ ticketNumber: -1 }).select("ticketNumber").lean<{ ticketNumber?: string }>();
    const start = parseInt(last?.ticketNumber?.replace(/\D/g, "") || "0", 10) || 0;
    // Two first-tickets racing both try to create it; the loser's duplicate-key
    // error is expected, and both then increment the same document below.
    await Counter.create({ _id: key, seq: start }).catch(() => {});
    counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true });
  }

  return `TKT-${String(counter!.seq).padStart(5, "0")}`;
}
