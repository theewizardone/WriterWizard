require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');
const mongoose = require("mongoose");
const stripe = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY);
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5001;

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

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a professional editor..." },
        { role: "user", content: `Rewrite this in a ${tone} tone: ${text}` }
      ],
      temperature: creativity / 10,
      max_tokens: 1000
    });

    const humanizedText = completion.choices[0].message.content;

    user.credits -= creditsNeeded;
    await user.save();

    res.json({ humanizedText, creditsUsed: creditsNeeded, remainingCredits: user.credits });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to process text' });
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
// Start Server
// ==================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
