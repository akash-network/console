import axios from "axios";

export default function handler(req, res) {
  const { code } = req.body;
  const { NEXT_PUBLIC_GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = process.env;

  if (code) {
    axios
      .post(`https://gitlab.com/oauth/token`, {
        client_id: NEXT_PUBLIC_GITLAB_CLIENT_ID,
        client_secret: GITLAB_CLIENT_SECRET,
        code,
        redirect_uri: NEXT_PUBLIC_REDIRECT_URI,
        grant_type: "authorization_code"
      })
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
