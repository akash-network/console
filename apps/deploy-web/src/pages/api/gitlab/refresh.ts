import axios from "axios";

export default function handler(req, res) {
  const { refreshToken } = req.body;
  const { NEXT_PUBLIC_GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET } = process.env;

  if (refreshToken) {
    axios
      .post(`https://gitlab.com/oauth/token`, {
        client_id: NEXT_PUBLIC_GITLAB_CLIENT_ID,
        client_secret: GITLAB_CLIENT_SECRET,
        refresh_token: refreshToken,

        grant_type: "refresh_token"
      })
      .then(response => {
        const params = new URLSearchParams(response.data);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        res.status(200).json({ access_token, refresh_token });
      })
      .catch(err => {
        res.status(500).send(err);
      });
  } else {
    res.status(400).send("No code provided");
  }
}
