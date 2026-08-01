# Auth-Gated App Testing Playbook

This file is for testing agents. Use these steps to validate the Emergent Google Auth flow on the Foot-Care Marketplace OS.

## Test identities (real, seeded)
- **Admin**: `sbtheg04@gmail.com` — set as admin via `ADMIN_EMAILS` env in backend/.env
- **Seeded providers** (linkable when logged in with matching email): 
  - Maya Okonkwo — `maya@solecare.demo`
  - Jordan Reyes — `jordan@solecare.demo`
  - Alex Novak — `alex@solecare.demo`

## Bypass Google — create a real test session directly

```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-admin-' + Date.now();
var sessionToken = 'test_session_admin_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'sbtheg04@gmail.com',
  name: 'SB (Admin)',
  role: 'admin',
  picture: 'https://via.placeholder.com/150',
  linked_provider_id: null,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('session_token=' + sessionToken);
print('user_id=' + userId);
"
```

## Backend curl checks

```bash
# /auth/me
curl -s "$API/api/auth/me" -H "Authorization: Bearer $TOKEN" | jq .

# Admin-only endpoints — should 200 for admin, 403 for client
curl -s "$API/api/admin/providers" -H "Authorization: Bearer $TOKEN"

# Become a provider (must be a client — creates a pending provider tied to caller.user_id)
curl -s -X POST "$API/api/provider/self-signup" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test Provider","bio":"...","city":"Berkeley","categories":["massage"],"weekly_hours":{"mon":[9,17]},"travel_zone":{"base_city":"Berkeley","radius_km":10}}'
```

## Playwright — set the session cookie

```python
await page.context.add_cookies([{
    "name": "session_token",
    "value": TOKEN,
    "domain": "footcare-marketplace.preview.emergentagent.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None",
}])
await page.goto("https://footcare-marketplace.preview.emergentagent.com/")
```

## Cleanup

```bash
mongosh --eval "use('test_database'); db.users.deleteMany({email: /test\.user\./}); db.user_sessions.deleteMany({session_token: /test_session/});"
```
