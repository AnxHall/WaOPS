# WaNotify Development

## Provider interface

```text
validateConfig()
send()
getDeliveryStatus()
supportsReceipts()
```

## Delivery flow
policy -> render -> quota check -> send -> receipt -> audit.

## Webhook
- sign payload
- timestamp
- delivery ID
- retry
- disable after repeated permanent failures only by policy

## Email
Count toward quota only according to configured commercial rule.
