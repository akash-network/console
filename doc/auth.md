# 🔐 Auth

Akash Network apps implement the OAuth2 spec for login flow.  
For local development, it is possible to use [mock-oauth2-server](https://github.com/navikt/mock-oauth2-server).

The `deploy-web` and `api` `.env.local.sample` files already contain relevant configurations to work with the mock server.

Auth is implemented in a way that allows switching between a real provider like Auth0 and the mock server based on environment configuration.

The mock server’s login page generates user data using `faker`, but the output can be easily modified.

---

## 🧪 Getting a Test Token

A test access token can be obtained manually:

```bash
curl -X POST http://localhost:8080/default/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=debug" \
  -d "client_id=debug-client" \
  -d "code_verifier=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN123456"
```

This returns a valid access_token, id_token, and refresh_token for local testing.

The claims can be configured via the mock server config (see requestMappings with code=debug).