import mongoose, { Schema } from 'mongoose';

// Running numbers (application IDs). $inc on one document is atomic, so two submissions at the same
// moment never get the same number, and no ID list has to be read to find the next one.
interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
}, { versionKey: false });

const Counter = (mongoose.models.Counter as mongoose.Model<ICounter>) || mongoose.model<ICounter>('Counter', CounterSchema);

/**
 * The next number of the counter `name`. The first time (no counter yet) it starts above
 * `highestInUse()` — the numbers given out before the counter existed.
 */
export async function nextNumber(name: string, highestInUse: () => Promise<number>): Promise<number> {
  if (!(await Counter.exists({ _id: name }))) {
    const top = await highestInUse();
    // $max: several first calls at once all end up at the same starting point
    await Counter.updateOne({ _id: name }, { $max: { seq: top } }, { upsert: true });
  }
  const counter = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true }).lean();
  return counter!.seq;
}

export default Counter;
