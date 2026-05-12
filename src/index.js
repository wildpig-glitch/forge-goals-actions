import api, { fetch } from '@forge/api';

const GRAPHQL_ENDPOINT = 'https://api.atlassian.com/graphql';

/**
 * Execute a GraphQL mutation/query against the Atlassian Goals API.
 * Uses Forge's fetch with asUser() so auth is handled automatically.
 */
async function executeGraphQL(query, variables = {}) {
  const response = await api.asUser().requestAtlassian('/gateway/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GraphQL request failed (${response.status}): ${text}`);
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL errors: ${json.errors.map(e => e.message).join(', ')}`);
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// CREATE GOAL
// ---------------------------------------------------------------------------
export async function createGoal(payload) {
  const { siteId, name, goalTypeId, targetDate, targetDateConfidence, description, ownerId } = payload;

  // containerId is required — it identifies the site/workspace
  const containerId = `ari:cloud:townsquare::site/${siteId}`;

  const mutation = `
    mutation CreateGoal($input: goals_CreateGoalInput!) {
      goals_create(input: $input) @optIn(to: "Townsquare") {
        goal {
          id
          name
          key
          targetDate {
            date
            confidence
          }
        }
        errors {
          message
        }
      }
    }
  `;

  const input = {
    containerId,
    name,
    goalTypeId: goalTypeId || null,
    targetDate: targetDate ? {
      date: targetDate,
      confidence: targetDateConfidence || 'QUARTER',
    } : undefined,
    description: description ? {
      adf: JSON.stringify({
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }]
      })
    } : undefined,
  };

  // Remove undefined fields
  Object.keys(input).forEach(k => input[k] === undefined && delete input[k]);

  const data = await executeGraphQL(mutation, { input });

  const result = data?.goals_create;
  if (result?.errors?.length > 0) {
    throw new Error(`Failed to create goal: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return {
    success: true,
    goal: result?.goal,
    message: `Goal "${result?.goal?.name}" created successfully with key ${result?.goal?.key}.`,
  };
}

// ---------------------------------------------------------------------------
// CLONE GOAL
// ---------------------------------------------------------------------------
export async function cloneGoal(payload) {
  const { goalId, newName } = payload;

  const mutation = `
    mutation CloneGoal($input: goals_CloneGoalInput!) {
      goals_clone(input: $input) @optIn(to: "Townsquare") {
        goal {
          id
          name
          key
        }
        errors {
          message
        }
      }
    }
  `;

  const input = { goalId };
  if (newName) input.name = newName;

  const data = await executeGraphQL(mutation, { input });

  const result = data?.goals_clone;
  if (result?.errors?.length > 0) {
    throw new Error(`Failed to clone goal: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return {
    success: true,
    goal: result?.goal,
    message: `Goal cloned successfully. New goal: "${result?.goal?.name}" (${result?.goal?.key}).`,
  };
}

// ---------------------------------------------------------------------------
// UPDATE / EDIT GOAL
// ---------------------------------------------------------------------------
export async function updateGoal(payload) {
  const { goalId, name, description, targetDate, targetDateConfidence, archived } = payload;

  const mutation = `
    mutation UpdateGoal($input: goals_EditGoalInput!) {
      goals_edit(input: $input) @optIn(to: "Townsquare") {
        goal {
          id
          name
          key
          isArchived
          targetDate {
            date
            confidence
          }
        }
        errors {
          message
        }
      }
    }
  `;

  const input = { goalId };
  if (name !== undefined) input.name = name;
  if (archived !== undefined) input.archived = archived;
  if (targetDate !== undefined) {
    input.targetDate = {
      date: targetDate,
      confidence: targetDateConfidence || 'QUARTER',
    };
  }
  if (description !== undefined) {
    input.description = {
      adf: JSON.stringify({
        version: 1,
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }]
      })
    };
  }

  const data = await executeGraphQL(mutation, { input });

  const result = data?.goals_edit;
  if (result?.errors?.length > 0) {
    throw new Error(`Failed to update goal: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return {
    success: true,
    goal: result?.goal,
    message: `Goal "${result?.goal?.name}" (${result?.goal?.key}) updated successfully.`,
  };
}

// ---------------------------------------------------------------------------
// DELETE / ARCHIVE GOAL
// (The Goals API uses archiving rather than hard delete)
// ---------------------------------------------------------------------------
export async function deleteGoal(payload) {
  const { goalId } = payload;

  // Goals API uses archive as the "delete" mechanism
  const mutation = `
    mutation ArchiveGoal($input: goals_EditGoalInput!) {
      goals_edit(input: $input) @optIn(to: "Townsquare") {
        goal {
          id
          name
          key
          isArchived
        }
        errors {
          message
        }
      }
    }
  `;

  const input = { goalId, archived: true };

  const data = await executeGraphQL(mutation, { input });

  const result = data?.goals_edit;
  if (result?.errors?.length > 0) {
    throw new Error(`Failed to archive/delete goal: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return {
    success: true,
    goal: result?.goal,
    message: `Goal "${result?.goal?.name}" (${result?.goal?.key}) has been archived/deleted.`,
  };
}

// ---------------------------------------------------------------------------
// POST GOAL UPDATE (status update / progress note)
// ---------------------------------------------------------------------------
export async function postGoalUpdate(payload) {
  const { goalId, summary, status, score, targetDate, targetDateConfidence } = payload;

  const mutation = `
    mutation CreateGoalUpdate($input: goals_CreateGoalUpdateInput!) {
      goals_createUpdate(input: $input) @optIn(to: "Townsquare") {
        success
        errors {
          message
        }
        update {
          id
          url
          creationDate
          summary
          newScore
          newTargetDate
          newTargetDateConfidence
        }
      }
    }
  `;

  const adfSummary = JSON.stringify({
    version: 1,
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: summary }]
    }]
  });

  const input = { goalId, summary: adfSummary };
  if (status) input.status = status;
  if (score !== undefined) input.score = score;
  if (targetDate) {
    input.targetDate = {
      date: targetDate,
      confidence: targetDateConfidence || 'QUARTER',
    };
  }

  const data = await executeGraphQL(mutation, { input });

  const result = data?.goals_createUpdate;
  if (result?.errors?.length > 0) {
    throw new Error(`Failed to post goal update: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return {
    success: true,
    update: result?.update,
    message: `Update posted successfully to goal. Status: ${status || 'unchanged'}.`,
  };
}
