# DuukaTalk

DuukaTalk is a voice-first sales and credit ledger for market vendors. Vendors can record a transaction naturally in English, Luganda, Swahili, or a mixture of languages. The application transcribes the recording, extracts structured transaction fields, stores complete records in Firestore, and presents the results in a lightweight ledger dashboard.

## Features

- Record transactions from the browser microphone.
- Transcribe audio through Sunbird Speech-to-Text.
- Extract item, quantity, price, customer, payment type, and due date with Sunflower.
- Retry structured extraction with Gemini when the Sunflower response cannot be parsed and a Gemini key is configured.
- Review ledger entries, outstanding customer credit, summaries, and risk flags.
- Export the currently filtered ledger as a CSV file.
- Use English, Luganda, or a mixed English/Luganda interface.

## Technology

- Next.js 16 with the App Router and TypeScript
- React 19
- Firebase Firestore
- Sunbird AI for speech-to-text and Sunflower extraction
- Google Generative AI for optional extraction fallback
- Tailwind CSS 4 and Lucide icons

## Prerequisites

- Node.js 20 or later
- npm
- A Firebase project with Firestore enabled
- A Sunbird API key
- A Gemini API key if fallback extraction is required

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root. Use the variable reference below and fill in values from your Firebase, Sunbird, and Google AI projects.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

Restart the development server after changing environment variables.

## Environment Variables

```dotenv
# AI provider selection. The current implementation supports "sunbird".
AI_PROVIDER=sunbird
SUNBIRD_API_KEY=your_sunbird_api_key

# Sunbird language code. Defaults to "eng" when omitted.
# Set this to the language code supported by your Sunbird account.
SUNBIRD_LANGUAGE=eng

# Optional. Enables Gemini when Sunflower returns invalid or unparseable JSON.
GEMINI_API_KEY=your_gemini_api_key

# Firebase web application configuration.
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

Do not commit `.env.local` or expose provider credentials in client-side code. The `NEXT_PUBLIC_FIREBASE_*` values are Firebase web configuration values; access to Firestore must still be controlled with appropriate Firebase security rules.

## How It Works

The main voice workflow is handled by `POST /api/voice-to-json`:

1. The browser uploads an audio file as multipart form data under the `audio` field.
2. Sunbird transcribes the recording using `SUNBIRD_LANGUAGE`.
3. Sunflower extracts a strict JSON transaction shape.
4. If extraction JSON is malformed, Gemini is used once when `GEMINI_API_KEY` is configured.
5. Required fields are validated. Incomplete but valid extraction returns a clarification response rather than creating a ledger record.
6. Complete transactions are timestamped by the server and written to the `transactions` Firestore collection.

Audio uploads are limited to 50 MB. Required fields for a complete transaction are `item`, `quantity`, `unitPrice`, and `paymentType`. Customer name, unit, and due date may be unknown; due dates are relevant to credit transactions.

## API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/voice-to-json` | Transcribe audio, extract a transaction, and persist complete records. |
| `POST` | `/api/extract-transaction` | Legacy extraction flow using Sunbird STT and Gemini. |
| `GET` | `/api/ledger` | Return documents from the `transactions` collection. |
| `GET` | `/api/summary` | Calculate cash sales and outstanding credit totals. |
| `GET` | `/api/credit` | Aggregate outstanding credit by customer. |
| `GET` | `/api/risk` | Flag credit totals above UGX 15,000 and quantities above 20. |

The primary voice route returns one of these outcomes:

- A completed transaction with `success: true`.
- `needsClarification: true` plus `missingFields` when the model returned valid but incomplete data.
- `success: false` with an error message when validation, provider, or persistence fails.

## Firestore Data

Transactions are stored in the `transactions` collection with fields including:

- `transaction_id`, `vendor_id`, and server-generated `timestamp`
- `item`, `quantity`, `unit`, and calculated `total_amount`
- `customer_name`, `payment_type`, and `due_date`
- `raw_transcript` and `confidence_flag`

The current persistence adapter uses the demo vendor identifier `vendor_001`. Replace that value and add authentication-aware access controls before using the application for multiple vendors or production data.

## Available Scripts

```bash
npm run dev      # Start the local development server
npm run lint     # Run ESLint
npm run build    # Create a production build
npm run start    # Serve the production build
```

## Troubleshooting

- **Missing `SUNBIRD_API_KEY`:** Add the key to `.env.local`; the default provider is Sunbird.
- **Voice recording does not start:** Allow microphone access in the browser and use a secure origin such as `localhost` or HTTPS.
- **Live screens show local data:** Check Firebase configuration, Firestore availability, and browser/server logs. The dashboard falls back to local sample data when one or more read routes fail.
- **Extraction needs clarification:** The audio was processed, but one or more required fields were not clear. Record the item, quantity, unit price, and whether the sale was cash or credit more explicitly.
- **Firestore permission errors:** Review Firestore security rules and ensure the configured Firebase project is the intended project.

## Deployment

Build the application with `npm run build` and run it with `npm run start`, or deploy it to a Node-compatible Next.js host such as Vercel. Configure all required environment variables in the hosting provider before deploying. Server-side routes must be able to reach Sunbird, Gemini when enabled, and Firebase.

## Project Structure

```text
app/
  page.tsx                    Dashboard and recording experience
  globals.css                 Global styles
  api/                        Next.js route handlers
lib/
  ai-provider.ts              Sunbird provider and Gemini fallback
  firebase.ts                 Firestore client initialization
  firestore-transaction.ts   Firestore transaction mapping
  schema.ts                   Transaction validation and types
public/                       Static assets
```