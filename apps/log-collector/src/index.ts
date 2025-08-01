/**
 * Main entry point for the Kubernetes log collector application
 *
 * This module bootstraps the application and starts the log collection process.
 * The application will discover Kubernetes pods, collect their logs, and write
 * them to local files for external log agents to process.
 */
import { bootstrap } from "@src/bootstrap/bootstrap";

bootstrap();
