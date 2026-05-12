# forge-goals-actions — Session Context

## Goal
Enable Rovo Dev to create, update, clone, and delete Atlassian Goals programmatically
during a conversation session, without manually invoking the Rovo UI.

## What Was Built
A Forge app (`forge-goals-actions`) with 5 Rovo actions:
- `goals-create` — Create a new Atlassian Goal
- `goals-clone` — Clone an existing Goal by ARI
- `goals-update` — Update name, description, target date, archive status
- `goals-delete` — Archive/delete a Goal
- `goals-post-update` — Post a status update with summary, status, score

**Deployed to:** `sk-demo-site.atlassian.net` (development environment)
**GitHub:** https://github.com/wildpig-glitch/forge-goals-actions
**App ID:** `ari:cloud:ecosystem::app/e40ddbfc-09bd-499f-a868-0dace7f3c7fc`
**Site ID:** `0647a1af-66be-4b3c-8ea3-06d8cd5847fb`
**Org ID:** `ef5637e6-517f-43af-a915-55754048e4c2`

## Why the Rovo Actions Approach Doesn't Fully Work for Rovo Dev

The Forge actions are available to the **Goals Manager Rovo agent** (installed on sk-demo-site)
but NOT directly callable by **Rovo Dev** in a conversation. Rovo Dev can only call tools
exposed via MCP, and the Goals MCP toolset is currently read-only.

## Agreed Solution: Script-Based Approach via OS Environment Variable

### How it works
On skill invocation, Rovo Dev will:
1. Write a shell script that calls the Goals GraphQL API using `$ATLASSIAN_TOKEN`
   (the variable NAME is written to the script, never the value)
2. Execute the script via the bash tool
3. bash resolves `$ATLASSIAN_TOKEN` from the OS environment at runtime
4. The token value **never appears in the conversation or reaches the LLM** ✅

### GraphQL Endpoint
```
https://sk-demo-site.atlassian.net/gateway/api/graphql
```

### Authentication
Basic Auth: base64-encoded `email:api_token`
```bash
# To generate the token value:
echo -n "your-email@domain.com:your-api-token" | base64
```

### Environment Variable Setup (one-time, on your machine)

**Recommended: macOS Keychain (most secure)**
```bash
# Store once:
security add-generic-password -a "$USER" -s "ATLASSIAN_TOKEN" -w "your-base64-token"

# Add to ~/.zshrc so it's available in every session including Rovo Dev:
export ATLASSIAN_TOKEN=$(security find-generic-password -a "$USER" -s "ATLASSIAN_TOKEN" -w)
```

**Alternative: ~/.atlassian-secrets file**
```bash
# Create file (outside any git repo):
echo 'export ATLASSIAN_TOKEN="your-base64-token"' >> ~/.atlassian-secrets
chmod 600 ~/.atlassian-secrets

# Add to ~/.zshrc:
[ -f ~/.atlassian-secrets ] && source ~/.atlassian-secrets
```

## One-Time Setup: Creating the Atlassian API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**, give it a label like "Rovo Dev Goals Script"
3. Copy the token value
4. Generate the base64-encoded credential:
   ```bash
   echo -n "your-email@domain.com:your-api-token" | base64
   ```
5. Store it securely in macOS Keychain:
   ```bash
   security add-generic-password -a "$USER" -s "ATLASSIAN_TOKEN" -w "paste-base64-output-here"
   ```
6. Add this line to your `~/.zshrc` (runs on every new shell session):
   ```bash
   export ATLASSIAN_TOKEN=$(security find-generic-password -a "$USER" -s "ATLASSIAN_TOKEN" -w)
   ```
7. Reload your shell:
   ```bash
   source ~/.zshrc
   ```
8. Verify it works (should print the base64 string, NOT empty):
   ```bash
   echo $ATLASSIAN_TOKEN
   ```

Once this is done, Rovo Dev can write and execute scripts that call the Goals API
using `$ATLASSIAN_TOKEN` — the value never enters the conversation or reaches the LLM.

---

## Next Steps (not yet implemented)

1. **User sets up `$ATLASSIAN_TOKEN`** in their shell using one of the methods above
2. **Update `.rovodev/prompts.yml`** at workspace root to include the Goals skill instructions
3. **Create reusable script templates** in `forge-goals-actions/scripts/` for each operation
4. **Test** by asking Rovo Dev to create a goal — it should write and execute the script on the fly

## Key Security Properties of This Approach
- ✅ Token never typed into the conversation
- ✅ Token never in any skill/prompt file
- ✅ Token never sent to the LLM (Claude/Anthropic)
- ✅ Token resolved at bash runtime only
- ✅ Only the API response (goal ID, name) comes back into the conversation
- ⚠️ Token is an OS env var — readable by other processes running as your user
- ⚠️ Mitigated by using macOS Keychain and a dedicated, revocable API token

## Goals GraphQL API Reference

**Create a goal:**
```graphql
mutation CreateGoal {
  goals_create(input: {
    containerId: "ari:cloud:townsquare::site/{siteId}"
    name: "Goal Name"
    targetDate: { date: "2026-12-31", confidence: QUARTER }
  }) @optIn(to: "Townsquare") {
    goal { id name key }
    errors { message }
  }
}
```

**Clone a goal:**
```graphql
mutation CloneGoal {
  goals_clone(input: {
    goalId: "ari:cloud:townsquare:{siteId}:goal/{goalUuid}"
    name: "Cloned Goal Name"
  }) @optIn(to: "Townsquare") {
    goal { id name key }
    errors { message }
  }
}
```

**Update a goal:**
```graphql
mutation UpdateGoal {
  goals_edit(input: {
    goalId: "ari:cloud:townsquare:{siteId}:goal/{goalUuid}"
    name: "New Name"
    archived: false
  }) @optIn(to: "Townsquare") {
    goal { id name key isArchived }
    errors { message }
  }
}
```

**Archive/delete a goal:**
```graphql
mutation ArchiveGoal {
  goals_edit(input: {
    goalId: "ari:cloud:townsquare:{siteId}:goal/{goalUuid}"
    archived: true
  }) @optIn(to: "Townsquare") {
    goal { id name key isArchived }
    errors { message }
  }
}
```

**Post a status update:**
```graphql
mutation PostUpdate {
  goals_createUpdate(input: {
    goalId: "ari:cloud:townsquare:{siteId}:goal/{goalUuid}"
    summary: "{\"version\":1,\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Your update text here.\"}]}]}"
    status: "on_track"
    score: 75
  }) @optIn(to: "Townsquare") {
    success
    update { id url creationDate newScore }
    errors { message }
  }
}
```

## Status Values
`on_track` | `at_risk` | `off_track` | `done` | `pending` | `paused` | `cancelled`

## Target Date Confidence Values
`DAY` | `WEEK` | `MONTH` | `QUARTER` | `YEAR`

## Goal ARI Format
```
ari:cloud:townsquare:{siteId}:goal/{goalUuid}
```

## sk-demo-site Goals (as of 2026-05-12)
| Key | Name |
|---|---|
| SKDEM-29 | Increase Global Revenue by 20% by the End of the Fiscal Year |
| SKDEM-24 | Enhance Automation and AI Capabilities |
| SKDEM-22 | Establish process to find and evaluate emerging trends |
| SKDEM-20 | Capitalize on Emerging Technology Trends |
| SKDEM-19 | [O] Become market leader in the mobile app space |
| SKDEM-18 | [KR] Best in Class Mobile Apps |
| SKDEM-17 | Mobile experience usage boost to 50% of global MAU |
