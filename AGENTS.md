# forge-goals-actions

A Forge Rovo app that provides actions for full CRUD management of Atlassian Goals via the Goals GraphQL API.

## Actions

| Action Key | Verb | Description |
|---|---|---|
| `goals-create` | CREATE | Create a new Atlassian Goal |
| `goals-clone` | CREATE | Clone an existing Goal by ARI |
| `goals-update` | UPDATE | Update name, description, target date, or archive status |
| `goals-delete` | DELETE | Archive (delete) a Goal |
| `goals-post-update` | CREATE | Post a status update with summary, status, and progress score |

## Deploy

```bash
forge deploy && forge install --upgrade -s sk-demo-site.atlassian.net -p jira -e development --non-interactive
```

## Goal ARI Format

```
ari:cloud:townsquare:{siteId}:goal/{goalUuid}
```

## Site Container ARI Format (for create)

```
ari:cloud:townsquare::site/{siteId}
```

## Status Values

`on_track` | `at_risk` | `off_track` | `done` | `pending` | `paused` | `cancelled`

## Target Date Confidence Values

`DAY` | `WEEK` | `MONTH` | `QUARTER` | `YEAR`
