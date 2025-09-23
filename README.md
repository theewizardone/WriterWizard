# Writer Wizard – AI Text Humanizer

Writer Wizard is a full-stack web application that transforms AI-generated text into natural, human-like content. It features user authentication, a credit system, Stripe payments, and a modern, responsive frontend.

---

## Features

- **AI Text Humanization**: Uses OpenAI API to rewrite AI-generated text in a more human style.
- **User Authentication**: Secure registration and login with JWT.
- **Credit System**: Users spend credits to humanize text; credits are managed in MongoDB.
- **Stripe Integration**: Users can upgrade to premium and buy more credits via Stripe.
- **Customization**: Choose tone, creativity, and writing purpose for output.
- **Responsive UI**: Modern, mobile-friendly design with dark/light mode toggle.

---

## Project Structure

```
Wizardwriter/
│
├── Backend/
│   ├── models/           # Mongoose models (User.js)
│   ├── stripe/           # Stripe integration (checkout.js, webhook.js, config.js)
│   ├── server.js         # Main Express server
│   └── .env              # Environment variables (not committed)
│
├── frontend/
│   └── index.html        # Main frontend (HTML, CSS, JS)
│
├── .gitignore
└── README.md
```

---

## Setup Instructions

### 1. Backend

1. **Install dependencies**  
   ```sh
   cd Backend
   npm install
   ```

2. **Configure environment variables**  
   Create a .env file with:
   ```
   PORT=5001
   MONGO_URI=your_mongodb_connection_string
   OPENAI_API_KEY=your_openai_api_key
   JWT_SECRET=your_jwt_secret
   STRIPE_TEST_SECRET_KEY=your_stripe_test_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   FRONTEND_URL=http://localhost:8000
   ```

3. **Start the backend server**  
   ```sh
   npm run dev
   ```
   The server runs on `http://localhost:5001`.

### 2. Frontend

1. **Open the frontend**  
   Open index.html directly in your browser, or serve it with a static server.

---

## Environment Variables

- `OPENAI_API_KEY` – Your OpenAI API key
- `JWT_SECRET` – Secret for JWT token encryption
- `STRIPE_TEST_SECRET_KEY` – Stripe secret key for payments
- `STRIPE_WEBHOOK_SECRET` – Stripe webhook secret
- `FRONTEND_URL` – Your frontend URL (e.g., `http://localhost:8000`)
- `MONGO_URI` – MongoDB connection string

---

## API Endpoints

| Method | Endpoint                      | Description                       |
|--------|-------------------------------|-----------------------------------|
| POST   | `/api/register`               | User registration                 |
| POST   | `/api/login`                  | User login                        |
| POST   | `/api/humanize`               | Humanize AI text (auth required)  |
| GET    | `/api/user`                   | Get current user info (auth)      |
| POST   | `/api/create-checkout-session`| Create Stripe checkout session    |
| POST   | `/api/webhook`                | Stripe webhook handler            |

---

## Usage Flow

1. **Register/Login**  
   Users register or log in to receive credits.

2. **Humanize Text**  
   Paste AI-generated text, select tone/creativity/purpose, and click "Humanize". Each use deducts credits.

3. **Upgrade**  
   If out of credits, upgrade to premium via Stripe to receive more credits.

4. **Account Management**  
   View plan and credits in the account section.

---

## Deployment Notes

- Replace test keys and URLs with production values for deployment.
- Set up environment variables securely on your server.
- Configure Stripe webhooks to point to your deployed backend.
- Serve the frontend via a static host or CDN.

---

## Credits

**Founder:** Eng. Kobira Davis  
[Instagram: @44kobii](https://www.instagram.com/44kobii/)
**Co-Founder:** Eng. Morara Alfonce
[Github: (https://github.com/theewizardone)]

---

**Writer Wizard © 2023**  
AI Text Humanizer Tool – Augmenting human creativity with AI.
