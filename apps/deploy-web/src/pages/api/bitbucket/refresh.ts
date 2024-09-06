import axios from "axios";

export default function handler(req, res) {
  const tokenUrl = "https://bitbucket.org/site/oauth2/access_token";
  const { refreshToken } = req.body;
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);

  const { NEXT_PUBLIC_BITBUCKET_CLIENT_ID, BITBUCKET_CLIENT_SECRET } = process.env;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${NEXT_PUBLIC_BITBUCKET_CLIENT_ID}:${BITBUCKET_CLIENT_SECRET}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  if (refreshToken) {
    axios
      .post(tokenUrl, params.toString(), { headers })
      .then(response => {
        const params = new URLSearchParams(response.data);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        res.status(200).json({ access_token, refresh_token });
      })
      .catch(() => {
        res.status(500).send("Something went wrong");
      });
  } else {
    res.status(400).send("No code provided");
  }
}
