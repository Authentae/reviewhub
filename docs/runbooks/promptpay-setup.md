# PromptPay setup (Thailand)

PromptPay is the Bank of Thailand's instant-transfer rail. With it
configured, Thai customers can pay directly from any banking app
(SCB, Kbank, Krungsri, Bangkok Bank, Krungthai, etc.) by scanning a
QR — no card needed, no card-processor fees.

The endpoint is **inert until you set `PROMPTPAY_ID`**. With it unset,
`/api/billing/promptpay` returns 501 and the client hides the option.

## How it works

This is a **manual rail** — we generate the QR and the customer pays.
Payment confirmation is NOT automatic:

1. Customer clicks "Pay with PromptPay" on the upgrade screen
2. Client fetches `/api/billing/promptpay?plan=starter&cycle=monthly`
3. Server returns the EMVCo QR payload + amount in THB
4. Client renders the QR (using qrcode.js or similar)
5. Customer scans + pays from their banking app
6. Customer screenshots the receipt and emails it to you
7. You manually flip them to the paid plan via `/admin`

The reconciliation overhead is real, but for low-volume Thai SMB
accounts it's still cheaper than ~3% card fees + cross-border charges.

## One-time setup

1. Decide which PromptPay ID you want to receive at:
   - **10-digit Thai mobile** (e.g. `0812345678`) — easiest, the most
     common identifier; the receiver must have linked this number to a
     bank account at any Thai bank
   - **13-digit Thai citizen ID** (e.g. `1234567890123`) — works the same
     way, less common
2. Decide your USD→THB conversion rate. The default is 36 (a stable
   midpoint as of 2026). Update env when the rate drifts >5%.
3. In Railway → Variables on the **server** service, add:
   ```
   PROMPTPAY_ID=0812345678          (your phone or citizen ID)
   PROMPTPAY_NAME=ReviewHub          (optional — appears in some apps)
   PROMPTPAY_USD_THB=36              (optional — default 36)
   ```
4. Trigger a redeploy.

## Verifying it's live

```bash
curl https://reviewhub.review/api/health | jq '.components.promptpay'
# expected: "configured"
```

Authenticated request to fetch a QR for the Starter monthly plan:

```bash
TOKEN="$(curl -s -X POST https://reviewhub.review/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"…"}' | jq -r .token)"

curl -H "Authorization: Bearer $TOKEN" \
  'https://reviewhub.review/api/billing/promptpay?plan=starter&cycle=monthly' \
  | jq
```

Expected response shape:

```json
{
  "payload": "00020101021229370016A000000677010111…6304XXXX",
  "amount_thb": 504,
  "amount_usd": 14,
  "receiver_name": "ReviewHub",
  "plan": "starter",
  "cycle": "monthly"
}
```

## Disabling

Unset `PROMPTPAY_ID`, redeploy. The endpoint reverts to 501 and the
client hides the option.

## Reconciliation tips

- Set up a dedicated PromptPay receiver account so payments don't mix
  with personal banking
- Keep a spreadsheet (or use Frill / ReviewHub's own dashboard) tracking
  transfer ID → user email
- Reply to the customer's receipt-screenshot email with confirmation
  once you flip them in `/admin` — closes the loop and avoids dupes
