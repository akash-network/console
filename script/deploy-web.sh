#!/bin/bash

deploy_web() {
  local instance_name=$1;
  local tag=$2;
  local deployment_env=$3;

  docker build \
    -f docker/Dockerfile.nextjs \
    --target production-nginx \
    --build-arg WORKSPACE=apps/deploy-web \
    --build-arg DEPLOYMENT_ENV=$deployment_env \
    --platform linux/amd64 \
    -t gcr.io/cloudmos-explorer/console-deploy-web:$tag .;

  docker push gcr.io/cloudmos-explorer/console-deploy-web:$tag;

  gcloud compute instances update-container $instance_name \
    --container-image=gcr.io/cloudmos-explorer/console-deploy-web:$tag;
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  deploy_web "$@"
fi