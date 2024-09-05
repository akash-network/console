import axios from "axios";

const githubApi = "https://github.com";

export default function handler(req, res) {
  const { code } = req.body;
  const { NEXT_PUBLIC_GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI } = process.env;

  if (code) {
    axios
      .post(`${githubApi}/login/oauth/access_token`, {
        client_id: NEXT_PUBLIC_GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: NEXT_PUBLIC_REDIRECT_URI
      })
      .then(response => {
        const params = new URLSearchParams(response.data);
        const access_token = params.get("access_token");
        res.status(200).json({ access_token });
      })
      .catch(() => {
        res.status(500).send("Something went wrong");
      });
  } else {
    res.status(400).send("No code provided");
  }
}
