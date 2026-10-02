import { Schema, model, Document, Types } from "mongoose";

/** A configured payment gateway account. At most one per tenant is active. */
export interface IPaymentGateway extends Document {
  tenant: Types.ObjectId;
  provider: string;
  label: string;
  mode: "test" | "live";
  /** field key → value; secret fields are stored encrypted (see services/payments/crypto). */
  credentials: Record<string, string>;
  isActive: boolean;
  lastTest?: { ok: boolean; message: string; at: Date };
}

const paymentGatewaySchema = new Schema<IPaymentGateway>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    provider: { type: String, required: true },
    label: { type: String, default: "", trim: true },
    mode: { type: String, enum: ["test", "live"], default: "test" },
    credentials: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: false },
    lastTest: { ok: Boolean, message: String, at: Date },
  },
  { timestamps: true, minimize: false }
);

export const PaymentGateway = model<IPaymentGateway>("PaymentGateway", paymentGatewaySchema);

/** One payment attempt, whichever gateway handled it. */
export interface IPaymentTransaction extends Document {
  tenant: Types.ObjectId;
  gateway: Types.ObjectId;
  provider: string;
  mode: "test" | "live";
  txnId: string;
  amount: number;
  currency: string;
  purpose: string;
  status: "created" | "pending" | "paid" | "failed";
  customer: { name: string; email: string; phone: string };
  /** What this payment is for, e.g. { module: "events", id: "<registration id>" }. */
  reference?: { module?: string; id?: string };
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  /** Where the customer's browser is sent once the result is known. */
  returnUrl?: string;
  message?: string;
  paidAt?: Date;
  isTest: boolean;
}

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    gateway: { type: Schema.Types.ObjectId, ref: "PaymentGateway", required: true },
    provider: { type: String, required: true },
    mode: { type: String, enum: ["test", "live"], default: "test" },
    txnId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    purpose: { type: String, default: "" },
    status: { type: String, enum: ["created", "pending", "paid", "failed"], default: "created" },
    customer: { name: { type: String, default: "" }, email: { type: String, default: "" }, phone: { type: String, default: "" } },
    reference: { module: String, id: String },
    gatewayOrderId: { type: String, index: true },
    gatewayPaymentId: String,
    returnUrl: String,
    message: String,
    paidAt: Date,
    isTest: { type: Boolean, default: false },
  },
  { timestamps: true }
);
paymentTransactionSchema.index({ tenant: 1, createdAt: -1 });

export const PaymentTransaction = model<IPaymentTransaction>("PaymentTransaction", paymentTransactionSchema);
