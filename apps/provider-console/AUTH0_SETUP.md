# Auth0 Setup for Provider Console

This document explains how to set up Auth0 authentication for the Provider Console application.

## Environment Variables

To enable Auth0 authentication, you need to set the following environment variables in your `.env.local` file:

```bash
# Auth0 Domain (e.g., your-tenant.auth0.com)
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com

# Auth0 Client ID
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id

# Auth0 Client Secret (server-side only)
AUTH0_CLIENT_SECRET=your-client-secret

# Auth0 Audience (optional, for API access)
NEXT_PUBLIC_AUTH0_AUDIENCE=your-api-audience

# Base URL for the application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Testing Without Auth0

The application includes fallback mock authentication for testing when:
- Auth0 credentials are not configured (you'll see `client_id=undefined` in the URL)
- The backend is unavailable

When you click "Start with Akash HomeNode" without Auth0 configuration, the app will:
1. Detect that Auth0 environment variables are missing
2. Skip the Auth0 redirect and go directly to the callback page
3. Use mock authentication with a test user
4. Redirect to the setup page with the mock user

**Note**: If you see `client_id=undefined` in the Auth0 URL, this means the environment variables are not set up correctly, and the app will automatically fall back to mock authentication.

## Auth0 Configuration Steps

1. **Create an Auth0 Application**:
   - Go to your Auth0 Dashboard
   - Create a new "Single Page Application"
   - Note down the Domain and Client ID

2. **Configure Allowed Callback URLs**:
   - Add `http://localhost:3000/auth/callback` for development
   - Add your production URL for production

3. **Configure Allowed Logout URLs**:
   - Add `http://localhost:3000` for development
   - Add your production URL for production

4. **Set Environment Variables**:
   - Copy the example above to `.env.local`
   - Fill in your Auth0 credentials

5. **Test the Flow**:
   - Start the application
   - Click "Start with Akash HomeNode"
   - You should be redirected to Auth0 login
   - After authentication, you'll be redirected to the setup page

## Mock Authentication

If you want to test without setting up Auth0, the application will automatically use mock authentication when Auth0 is not properly configured. This allows for development and testing without requiring Auth0 setup.
