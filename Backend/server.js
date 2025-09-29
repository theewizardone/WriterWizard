require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const mongoose = require("mongoose");
const stripe = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY);
const axios = require("axios"); // for M-Pesa API
const User = require("./models/User");
const mpesaRoutes = require("./routes/mpesaRoutes.cjs");
const Payment = require("./models/Payment");
const path = require("path"); // for serving frontend
const trainingSystem = require('./training-system'); // Import the training system


const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());

app.use(cors({
  origin: 'http://localhost:8000', // Allow your frontend origin
  credentials: true
}));

// Serve all files inside frontend/
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(8000, () => {
  console.log("Frontend running at http://localhost:8000");
});

// use routes
app.use("/api", mpesaRoutes);



// ==================================================
// ✅ Stripe Webhook MUST come BEFORE express.json()
// ==================================================
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('✅ Checkout session completed:', session.id);

      const userId = session.client_reference_id;
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          plan: 'premium',
          $inc: { credits: 1000 },
        });
        console.log(`✅ User ${userId} upgraded to premium`);
      }
      break;
    }
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// ==================================================
// ✅ After webhook: enable JSON + middleware
// ==================================================
app.use(express.json());
app.use(cors());

// ==================================================
// MongoDB Connection
// ==================================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ==================================================
// OpenAI Setup
// ==================================================
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ==================================================
// JWT Auth Middleware
// ==================================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ==================================================
// Auth Routes
// ==================================================
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      plan: 'free',
      credits: 10
    });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, email: user.email, plan: user.plan, credits: user.credits }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, plan: user.plan, credits: user.credits }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================================================
// Humanize Endpoint
// ==================================================
app.post('/api/humanize', authenticateToken, async (req, res) => {
  try {
    const { text, tone, creativity } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.credits <= 0) return res.status(402).json({ error: 'Out of credits. Please upgrade.' });

    const wordCount = text.split(/\s+/).length;
    const creditsNeeded = Math.max(1, Math.ceil(wordCount / 100));

    if (user.credits < creditsNeeded) {
      return res.status(402).json({
        error: `Not enough credits. Need ${creditsNeeded} but only have ${user.credits}.`
      });
    }

    // Use the optimized system prompt
    const systemPrompt = trainingSystem.optimizedPrompt || "You are a professional editor.";


    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Rewrite this in a ${tone} tone: ${text}` }
      ],
      temperature: creativity / 10,
      max_tokens: 1000
    });

    const humanizedText = completion.choices[0].message.content;

    await trainingSystem.saveAIExample(text, humanizedText, tone);

    res.json({ humanizedText, creditsUsed: creditsNeeded, remainingCredits: user.credits });
  } catch (error) {
    // ...error handling...
  }
});

// ==================================================
// Get Current User
// ==================================================
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: { id: user._id, email: user.email, plan: user.plan, credits: user.credits }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================================================
// Stripe Checkout
// ==================================================

app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  console.log("👉 /api/create-checkout-session hit", req.body, req.user); 
  try {
    const { priceId } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      client_reference_id: req.user.id,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('❌ Error creating checkout session:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================================================
// M-Pesa STK Push Payment
// ==================================================

// Helper: Get M-Pesa access token
async function getMpesaToken() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const res = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } }
  );

  return res.data.access_token;
}

// Route: Initiate STK Push
app.post("/api/mpesa/pay", authenticateToken, async (req, res) => {
  try {
    const { phone, amount, accountReference, transactionDesc } = req.body; // <-- add these

    const token = await getMpesaToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: `${process.env.BACKEND_URL}/api/mpesa/callback`,
        AccountReference: accountReference || "HumanizerApp", // <-- use frontend value
        TransactionDesc: transactionDesc || "Upgrade Plan"     // <-- use frontend value
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response && err.response.data) {
        console.error("❌ M-Pesa STK error:", JSON.stringify(err.response.data, null, 2));
        res.status(500).json({ error: err.response.data });
    } else {
        console.error("❌ M-Pesa STK error:", err.message);
        res.status(500).json({ error: err.message });
    }
  };
});


// Route: M-Pesa Callback
app.post("/api/mpesa/callback", express.json(), async (req, res) => {
  try {
    const callbackData = req.body.Body.stkCallback;
    console.log("📥 Callback:", JSON.stringify(callbackData, null, 2));

    const { CheckoutRequestID, ResultCode, ResultDesc } = callbackData;

    const payment = await Payment.findOne({ transactionId: CheckoutRequestID });
    if (!payment) {
      console.warn("⚠️ No payment found for:", CheckoutRequestID);
      return res.json({ received: true });
    }

    payment.rawResponse = callbackData;

    if (ResultCode === 0) {
      payment.status = "success";

      // Upgrade user plan & credits
      const user = await User.findById(payment.userId);
      if (user) {
        user.plan = "premium";
        user.credits += 1000;
        await user.save();
      }
    } else {
      payment.status = "failed";
    }

    await payment.save();

    res.json({ received: true });
  } catch (err) {
    console.error("❌ Callback error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/payment-status/:transactionId", authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const payment = await Payment.findOne({ transactionId, userId: req.user.id });

    if (!payment) return res.status(404).json({ error: "Payment not found" });

    res.json({ status: payment.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ===============================
// GET /api/pricing-plans
// ===============================
app.get('/api/pricing-plans', (req, res) => {
  res.json([
    {
      id: 'basic',
      name: 'Basic',
      price: 1,
      credits: 100,
      features: ['100 credits', 'Email support'],
      stripePriceId: process.env.STRIPE_PRICE_ID
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 15,
      credits: 1000,
      features: ['1000 credits', 'Priority support'],
      stripePriceId: process.env.STRIPE_PRICE_ID // Add more price IDs if needed
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 25,
      credits: 2500,
      features: ['2500 credits', 'Priority support', 'Early access features'],
      stripePriceId: process.env.STRIPE_PRICE_ID // Add more price IDs if needed
    }
  ]);
});
// ===============================
// POST /api/create-stripe-session
// ===============================
app.post('/api/create-stripe-session', authenticateToken, async (req, res) => {
  try {
    const { priceId } = req.body;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', // <-- Change to 'subscription' if using recurring price
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      client_reference_id: req.user.id,
    });
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================================================
// Start Server
// ==================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
