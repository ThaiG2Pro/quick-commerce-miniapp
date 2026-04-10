# Server requirements for Mini App client

## 1) Storefront profile (logo, shop name, main address)

Client now reads storefront branding from Medusa first, with fallback to `app-config.json`.

### Preferred endpoint

- **GET** `/store/storefront-profile`
- Public Store API route (requires `x-publishable-api-key`)

Example response:

```json
{
  "storefront": {
    "shop_name": "Tiệm Tí Hon",
    "shop_address": "Z06 số 13, Tân Thuận Đông, Quận 7, TP.HCM",
    "logo_url": "https://your-cdn/logo.png"
  }
}
```

### Fallback supported by client

Client also tries **GET** `/store/store` and maps fields from:

- `store.name` / `store.shop_name`
- `store.address` / `store.shop_address`
- `store.logo_url`
- or the same values inside `store.metadata`

## 2) Branches / stations (2+ pickup locations)

Client now supports loading branches directly from backend.

### Endpoint

- **GET** `/store/branches`
- Public Store API route (requires `x-publishable-api-key`)

Accepted response keys: `branches` (preferred), `stations`, or `locations`.

Example response:

```json
{
  "branches": [
    {
      "id": "cn_q7",
      "name": "Chi nhánh Quận 7",
      "address": "Z06 số 13, Tân Thuận Đông, Quận 7, TP.HCM",
      "image": "https://your-cdn/branch-q7.jpg",
      "location": { "lat": 10.773756, "lng": 106.689247 }
    },
    {
      "id": "cn_tphu",
      "name": "Chi nhánh Tân Phú",
      "address": "123 ABC, Tân Phú, TP.HCM",
      "image": "https://your-cdn/branch-tanphu.jpg",
      "location": { "lat": 10.789, "lng": 106.623 }
    }
  ]
}
```

## 3) Zalo auth route already required by client

- **POST** `/auth/zalo`
- Body: `{ "accessToken": "<zalo_access_token>" }`
- Server must verify token with Zalo Open API and `appsecret_proof`.
- Return user/customer profile and optionally JWT token (`jwt` or `token` or `accessToken`) for Medusa SDK session.

## 4) Cart issue to fix on server

Current backend is returning:

- **POST** `/store/carts` -> `500 unknown_error` even with valid `region_id` and publishable key.

Client has been updated to always send `region_id`, but cart creation still fails due to server-side issue. Please inspect Render logs for cart workflow/database/config errors.
