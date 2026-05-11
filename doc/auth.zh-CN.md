# 🔐 Auth

[English](auth.md) | [simplified chinese](auth.zh-CN.md)

Akash Network apps 实现了 OAuth2 spec 用于 login flow。  
本地开发时，可以使用 [mock-oauth2-server](https://github.com/navikt/mock-oauth2-server)。

`deploy-web` 和 `api` 的 `.env.local.sample` 文件已经包含了与 mock server 配合使用的相关配置。

Auth 的实现方式允许根据环境配置，在 Auth0 这样的真实 provider 和 mock server 之间切换。

mock server 的 login page 使用 `faker` 生成 user data，但输出可以很容易地修改。

---

## 🧪 获取 Test Token

可以手动获取 test access token：

```bash
curl -X POST http://localhost:8080/default/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=debug" \
  -d "client_id=debug-client" \
  -d "code_verifier=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN123456"
```

这会返回一个可用于本地测试的有效 access_token、id_token 和 refresh_token。

claims 可通过 mock server config 配置（请参见带有 code=debug 的 requestMappings）。
