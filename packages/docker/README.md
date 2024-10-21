### `dc.sh` - Docker Compose Helper Script

This script is a wrapper around Docker Compose commands, specifically designed to manage the Akash Network Console Docker services.

#### Description:
`dc.sh` simplifies working with Docker Compose by handling different environments and specific options related to the Akash Network Console project.

#### Usage:
```bash
./dc.sh <command> [--no-db] [additional docker-compose options]
```

#### Commands:
- **build**: Build the Docker images using the `docker-compose.build.yml` file.
- **down**: Bring down the services and remove containers.
- **up:db**: Bring up only the database service, unless `--no-db` is specified.
- **up:dev**: Bring up development services with Docker Compose.
- **up:prod**: Bring up production services with Docker Compose.

#### Options:
- `--no-db`: Exclude the DB service from being started.
- `-h, --help`: Show help message with available commands and options.

#### Examples:
- Build Docker images:
  ```bash
  ./dc.sh build <docker-compose args>
  ```
- Start development services with the database:
  ```bash
  ./dc.sh up:dev <docker-compose args>
  ```
- Start development services without the database:
  ```bash
  ./dc.sh up:dev --no-db <docker-compose args>
  ```
- Bring down services and remove containers:
  ```bash
  ./dc.sh down <docker-compose args>
  ```

---

### `build.sh` - Docker Image Build Script

This script handles the building and tagging of Docker images, checking if an image already exists for the given Git SHA or tag. If not, it builds a new one.

#### Description:
- This script is designed to automate Docker image creation by using Git commit SHAs or semantic version tags to name and manage images.

#### Usage:
```bash
./build.sh -r <repo> -t <tag> -a <app>
```

#### Required Arguments:
- `-r <repo>`: The Docker repository to push the image.
- `-t <tag>`: The tag of the Docker image (typically in SemVer format).
- `-a <app>`: The application name for which the image is being built.

#### Behavior:
1. **Checks if an image exists**: It checks the Docker registry for images matching the Git SHA or the provided tag.
2. **Builds a new image**: If no image is found, it builds a new Docker image for the specified app.
3. **Tags images**: Tags the image with the provided SHA or SemVer tag.
4. **Pushes images**: Pushes the image to the Docker repository.

#### Example:
To build and push a new Docker image for the `my-app` application:
```bash
./build.sh -r my-docker-repo/my-app -t 1.0.0 -a my-app
```
