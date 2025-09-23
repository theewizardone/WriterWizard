const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true }, // M-Pesa CheckoutRequestID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  planId: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
  rawResponse: { type: Object }, // store full Safaricom callback
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
