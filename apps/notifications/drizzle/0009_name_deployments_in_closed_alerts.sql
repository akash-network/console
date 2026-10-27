UPDATE "alerts"
SET
  "summary" = 'Deployment {{{deployment.label}}} is now closed',
  "description" = 'Please visit {{{deployment.link}}} to manage your deployment and re-deploy if needed.'
WHERE "params"->>'type' = 'DEPLOYMENT_CLOSED'
  AND "summary" = 'Deployment {{alert.next.params.dseq}} is now closed'
  AND "description" LIKE 'Please visit <a href="https://%/deployments/%?tab=SETTINGS">%</a> to manage your deployment and re-deploy if needed.';
