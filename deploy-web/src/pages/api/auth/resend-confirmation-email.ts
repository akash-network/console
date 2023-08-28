import { getSession } from "@auth0/nextjs-auth0";
import { ManagementClient } from "auth0";

const management = new ManagementClient({
  domain: process.env.AUTH0_M2M_DOMAIN,
  clientId: process.env.AUTH0_M2M_CLIENT_ID,
  clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET
});

export default async function resendConfirmationEmail(req, res) {
  console.log("Resending confirmation email");
  try {
    const { user } = await getSession(req, res);

    await management.sendEmailVerification({ user_id: user.sub });

    res.send("Email sent");
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).end("Something went wrong");
  }
}
