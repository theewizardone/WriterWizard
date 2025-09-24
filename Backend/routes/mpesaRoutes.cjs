// mpesaRoutes.js
const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();
const router = express.Router();

// M-Pesa credentials from .env
const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;

// Utility: Get M-Pesa OAuth Token
async function getMpesaToken() {
  const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
  return res.data.access_token;
}

// POST /api/initiate-mpesa-payment
router.post("/initiate-mpesa-payment", async (req, res) => {
  try {
    const { planId, phoneNumber } = req.body;
    if (!planId || !phoneNumber) {
      return res.status(400).json({ error: "Missing planId or phoneNumber" });
    }

    const token = await getMpesaToken();

    // generate timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, "")
      .slice(0, 14);

    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");

    const stkURL = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

    const stkRes = await axios.post(
      stkURL,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: 25, // replace with plan price
        PartyA: phoneNumber,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: "https://mydomain.com/path", // replace with your callback URL
        AccountReference: `PLAN-${planId}`,
        TransactionDesc: "Payment for Humanizer Pro Plan",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    res.json({
      transactionId: stkRes.data.CheckoutRequestID,
      message: "M-Pesa STK push initiated. Please check your phone.",
    });
  } catch (err) {
    console.error("M-Pesa error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to initiate M-Pesa payment" });
  }
});

// M-Pesa callback route
router.post("/mpesa/callback", (req, res) => {
  console.log("M-Pesa Callback received:", JSON.stringify(req.body, null, 2));

  // TODO: save transaction status to DB
  res.json({ ResultCode: 0, ResultDesc: "Callback received successfully" });
});

// GET /api/payment-status/:transactionId
router.get("/payment-status/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;

    // TODO: lookup transaction status in DB
    // for now return pending → frontend keeps polling
    res.json({ status: "pending" });
  } catch (err) {
    res.status(500).json({ error: "Failed to check payment status" });
  }
});

module.exports = router;
