# Auth Testing Playbook

Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.findOne({email: "provider@test.com"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email, index on login_attempts.identifier.

Step 2: API Testing
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/register -H "Content-Type: application/json" -d '{"email":"provider@test.com","password":"test1234","name":"Test Provider"}'
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"provider@test.com","password":"test1234"}'
cat cookies.txt
curl -b cookies.txt http://localhost:8001/api/auth/me
curl -b cookies.txt -X PUT http://localhost:8001/api/providers/me -H "Content-Type: application/json" -d '{"name":"Test Provider","bio":"Certified foot care nurse","certifications":["CFCN"]}'
```

Login should return the user object and set `access_token` + `refresh_token` cookies. `/me` should return the same user. PUT /providers/me should set onboarding_complete=true.

Step 3: Brute force — 5 failed logins for same email should return 429 on 6th attempt.
