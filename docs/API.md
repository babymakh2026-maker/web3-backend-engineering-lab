# API Guide

All JSON success responses use a `data` envelope. Errors use an `error` object
with a stable machine-readable `code` and human-readable `message`.

## WETH Snapshot

```http
GET /api/v1/ethereum/weth-snapshot
```

The response identifies Ethereum mainnet, WETH9, the fixed block, and the four
decoded values. `totalSupplyWei` is a decimal string to preserve precision.

## MessageRegistry

```http
GET /api/v1/contracts/message-registry
```

Returns the deployed contract address, current message, and immutable owner.

```http
POST /api/v1/contracts/message-registry
Content-Type: application/json
x-portfolio-write-token: <server-configured token>

{"message":"Portfolio API write verified on Sepolia"}
```

Messages are trimmed, must contain 1 to 280 characters, and cannot contain
unrecognized properties. Success is returned only after two confirmations and a
matching read-after-write result.

## Notes

Create a note:

```http
POST /api/v1/notes
Content-Type: application/json

{"title":"Release checklist","content":"Run the verification gate."}
```

Use `GET /api/v1/notes` to list notes and `GET`, `PUT`, or `DELETE` on
`/api/v1/notes/{id}` for a single resource. `PUT` is a complete replacement and
requires both `title` and `content`. Successful deletion returns `204` with no
body.

## Error Codes

| Code | Status | Meaning |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | JSON shape or value is invalid |
| `INVALID_JSON` | 400 | Request body is malformed JSON |
| `CONTRACT_WRITE_UNAUTHORIZED` | 401 | Write token is absent or invalid |
| `NOTE_NOT_FOUND` | 404 | Note ID does not exist |
| `ROUTE_NOT_FOUND` | 404 | Route does not exist |
| `CONTRACT_WRITE_DISABLED` | 503 | Server write token is not configured |
| `CONTRACT_SIGNER_UNAVAILABLE` | 503 | Sepolia signer is not configured |
| `ETHEREUM_READ_FAILED` | 502 | Mainnet provider read failed |
| `SEPOLIA_READ_FAILED` | 502 | Contract read failed |
| `SEPOLIA_WRITE_FAILED` | 502 | Contract write or confirmation failed |
