# Cloudmos Monorepo

## Projects

- [Explorer](/explorer/README.md) - Website API + NextJS frontend
- [Indexer](/indexer/) - The main indexer process
- [Shared](/shared/) - Shared project

## Create docker images

`./build.ps1 (web|api|indexer|notifications) [version] [-deploy]`

The image version can be set by passing a second arguments or by using the `-version` parameter. If it is not specified it will be parsed from the `package.json`.

If the `-deploy` flag is set, the vm instance will be updated to the new version. There will be a downtime of ~2min while the vm restarts. **Only works for the API.**

The script will use the docker username of the current user (parsed from the `docker-credential-desktop list` command).
