# Rollback

## Application
Keep previous image version available.

## DB
Prefer forward-fix over down migration.
Breaking migrations require expand/contract.

## Agent
Updater maintains previous binary until health confirmation.

## Feature
Feature flags may disable new path if schema remains compatible.
