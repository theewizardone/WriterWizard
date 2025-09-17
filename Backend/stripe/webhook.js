// backend/stripe/webhook.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

const router = express.Router();

// ✅ Webhook must be raw, not JSON
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ Handle Stripe events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("✅ Checkout session completed:", session.id);

        try {
          // upgrade user in DB
          const userId = session.client_reference_id;
          await User.findByIdAndUpdate(userId, {
            plan: "premium",
            $inc: { credits: 1000 },
          });
          console.log(`🎉 User ${userId} upgraded to premium!`);
        } catch (dbError) {
          console.error("❌ Failed to update user:", dbError);
        }

        break;
      }
      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);

module.exports = router;
