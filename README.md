# Writer Wizard - AI Text Humanizer

A web application that transforms AI-generated text into natural, human-sounding content.

## Features

- AI text humanization using OpenAI API
- User authentication and credit system
- Stripe payment integration
- Responsive design with dark/light mode
- Customizable output (tone, creativity, purpose)

## Setup Instructions

1. Install dependencies: `npm install`
2. Create a `.env` file with your API keys
3. Start the server: `npm run dev`
4. Open `index.html` in a web browser

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `JWT_SECRET`: Secret for JWT token encryption
- `STRIPE_SECRET_KEY`: Stripe secret key for payments
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `FRONTEND_URL`: Your frontend URL

## API Endpoints

- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/humanize` - Text humanization
- `GET /api/user` - Get user info
- `POST /api/create-checkout-session` - Create Stripe checkout session
- `POST /api/webhook` - Stripe webhook handler

## Deployment

For production deployment:
1. Replace the in-memory user storage with a database
2. Set up environment variables on your server
3. Configure SSL certificates
4. Set up Stripe webhooks
5. Deploy frontend to a CDN or static hosting