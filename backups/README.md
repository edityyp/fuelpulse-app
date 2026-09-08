# Source checkpoints

GitHub commit history is the permanent source of truth. Download any commit's source archive from GitHub, or after a local clone run:

```sh
mkdir -p backups
git archive --format=zip --output=backups/fuelpulse-source.zip HEAD
```

Only tracked source is archived. Never include .env, credentials, database dumps, node_modules, or private test settings. An exported verified-core source checkpoint was additionally delivered through the conversation attachment and successfully restored after a sandbox restart. It contains actual frontend/backend/migration/test source and the locally generated package-lock.json, not just documentation. Documentation updates are retained in subsequent GitHub commits.
