/**
 * Main entry point for the Kubernetes log and event collector application
 *
 * This module bootstraps the application and starts log and event collection.
 * The application discovers Kubernetes pods, collects their container logs
 * and K8s events, and writes them to local files for Fluent Bit to process.
 */
import { bootstrap } from "@src/bootstrap/bootstrap";

bootstrap();
