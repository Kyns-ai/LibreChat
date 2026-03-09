const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { ensureRequiredCollectionsExist } = require('@librechat/api');
const { AccessRoleIds, ResourceType, PrincipalType, Constants } = require('librechat-data-provider');
const {
  logPromptMigrationWarning,
  checkAgentPermissionsMigration,
  checkPromptPermissionsMigration,
} = require('@librechat/api');
const { grantPermission } = require('~/server/services/PermissionService');
const { getProjectByName } = require('~/models/Project');
const { Agent, PromptGroup } = require('~/db/models');
const { findRoleByIdentifier } = require('~/models');

async function runAgentPermissionsMigration() {
  const db = mongoose.connection.db;
  if (db) {
    await ensureRequiredCollectionsExist(db);
  }

  const ownerRole = await findRoleByIdentifier(AccessRoleIds.AGENT_OWNER);
  const viewerRole = await findRoleByIdentifier(AccessRoleIds.AGENT_VIEWER);
  const editorRole = await findRoleByIdentifier(AccessRoleIds.AGENT_EDITOR);

  if (!ownerRole || !viewerRole || !editorRole) {
    logger.error('[Migration] Required roles not found — skipping agent migration');
    return { migrated: 0, errors: 0 };
  }

  const globalProject = await getProjectByName(Constants.GLOBAL_PROJECT_NAME, ['agentIds']);
  const globalAgentIds = new Set(globalProject?.agentIds || []);

  const agentsToMigrate = await Agent.aggregate([
    {
      $lookup: {
        from: 'aclentries',
        localField: '_id',
        foreignField: 'resourceId',
        as: 'aclEntries',
      },
    },
    {
      $addFields: {
        userAclEntries: {
          $filter: {
            input: '$aclEntries',
            as: 'entry',
            cond: {
              $and: [
                { $eq: ['$$entry.resourceType', ResourceType.AGENT] },
                { $eq: ['$$entry.principalType', PrincipalType.USER] },
              ],
            },
          },
        },
      },
    },
    {
      $match: {
        author: { $exists: true, $ne: null },
        userAclEntries: { $size: 0 },
      },
    },
    { $project: { _id: 1, id: 1, name: 1, author: 1, isCollaborative: 1 } },
  ]);

  if (agentsToMigrate.length === 0) {
    return { migrated: 0, errors: 0 };
  }

  const results = { migrated: 0, errors: 0 };

  for (const agent of agentsToMigrate) {
    try {
      const isGlobal = globalAgentIds.has(agent.id);

      await grantPermission({
        principalType: PrincipalType.USER,
        principalId: agent.author,
        resourceType: ResourceType.AGENT,
        resourceId: agent._id,
        accessRoleId: AccessRoleIds.AGENT_OWNER,
        grantedBy: agent.author,
      });

      if (isGlobal) {
        const publicRole = agent.isCollaborative
          ? AccessRoleIds.AGENT_EDITOR
          : AccessRoleIds.AGENT_VIEWER;

        await grantPermission({
          principalType: PrincipalType.PUBLIC,
          principalId: null,
          resourceType: ResourceType.AGENT,
          resourceId: agent._id,
          accessRoleId: publicRole,
          grantedBy: agent.author,
        });
      }

      results.migrated++;
      logger.info(`[Migration] Migrated agent "${agent.name}" (${isGlobal ? 'global' : 'private'})`);
    } catch (error) {
      results.errors++;
      logger.error(`[Migration] Failed to migrate agent "${agent.name}": ${error.message}`);
    }
  }

  return results;
}

async function checkMigrations() {
  try {
    const agentMigrationResult = await checkAgentPermissionsMigration({
      mongoose,
      methods: {
        findRoleByIdentifier,
        getProjectByName,
      },
      AgentModel: Agent,
    });

    if (agentMigrationResult.totalToMigrate > 0) {
      logger.info(
        `[Migration] ${agentMigrationResult.totalToMigrate} agent(s) need permissions — running auto-migration`,
      );
      const result = await runAgentPermissionsMigration();
      logger.info('[Migration] Agent permissions migration completed', result);
    }
  } catch (error) {
    logger.error('[Migration] Failed to check/run agent permissions migration:', error);
  }
  try {
    const promptMigrationResult = await checkPromptPermissionsMigration({
      mongoose,
      methods: {
        findRoleByIdentifier,
        getProjectByName,
      },
      PromptGroupModel: PromptGroup,
    });
    logPromptMigrationWarning(promptMigrationResult);
  } catch (error) {
    logger.error('Failed to check prompt permissions migration:', error);
  }
}

module.exports = {
  checkMigrations,
};
