# Preview deployments

Vercel's Git integration deploys production from `main`. Automatic Git deployments
for other branches are disabled in `apps/web/vercel.json`.

`.github/workflows/preview.yml` requests a Vercel Git-source preview when a same-repository
PR opens ready for review, is reopened, receives a commit, or is marked ready for
review. Draft and closed PRs do not request builds. This applies to each ready PR
in a stack, independently of the lowest-layer CI gate. CI tests and builds keep
their existing policy.

## One-time setup

Before merging this change, configure repository **Settings → Secrets and variables
→ Actions**:

- Secret `VERCEL_TOKEN`: a Vercel access token with permission to deploy the existing
  Journl project. Enter it through the secret UI; never commit it.
- Variable `VERCEL_PROJECT_ID`: the existing project's ID from Vercel project settings.
- Variable `VERCEL_TEAM_ID`: the owning team's ID, if the project belongs to a team.

Keep the existing Vercel GitHub connection, root directory `apps/web`, build settings,
and Preview environment variables. The API uses that project's settings and builds
on Vercel; Actions does not download environment secrets or execute application code.
Omitting a deployment target selects Preview, so this workflow cannot request a
production deployment.

The workflow uses `pull_request_target` to run the base branch's trusted workflow
and read the current PR state. It never checks out or runs PR code. Fork PRs are
excluded. Do not add PR-controlled scripts or checkout steps to this privileged job.

## Activation and limits

Merge this independent PR into `main`, then update existing feature branches with
`main` so their Vercel configuration also disables automatic branch previews.
For stacked PRs, update the stack from its root; all target branches must inherit
the workflow before their PR events use it. Until old branch configurations are
updated, Vercel may continue automatic previews for them.

Mark a draft ready, or push a commit to a ready PR, to request its preview. The
Actions summary links to the queued deployment; Vercel reports the build result.
Changing back to draft stops subsequent requests and cancels pending Actions runs.
It does not delete existing previews or cancel a build already accepted by Vercel.
There is a small race if draft state changes after the final GitHub check.

To roll back, remove the preview workflow and the `git.deploymentEnabled` override
together to restore Vercel's default automatic previews.

References: [Vercel Git deployment configuration](https://vercel.com/docs/project-configuration/git-configuration),
[Vercel deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment).
