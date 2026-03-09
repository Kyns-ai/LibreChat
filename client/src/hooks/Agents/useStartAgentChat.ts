import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Constants, EModelEndpoint, LocalStorageKeys, QueryKeys } from 'librechat-data-provider';
import type { Agent } from 'librechat-data-provider';
import { useChatContext } from '~/Providers';
import useDefaultConvo from '~/hooks/Conversations/useDefaultConvo';
import useLocalize from '~/hooks/useLocalize';
import { clearMessagesCache } from '~/utils';
import { upsertAgentListCaches } from '~/utils/agentCache';

export default function useStartAgentChat() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const getDefaultConversation = useDefaultConvo();
  const { conversation, newConversation } = useChatContext();

  return useCallback(
    (agent: Agent) => {
      upsertAgentListCaches(queryClient, agent);

      localStorage.setItem(`${LocalStorageKeys.AGENT_ID_PREFIX}0`, agent.id);
      localStorage.setItem(
        `${LocalStorageKeys.LAST_CONVO_SETUP}_0`,
        JSON.stringify({
          endpoint: EModelEndpoint.agents,
          agent_id: agent.id,
          conversationId: Constants.NEW_CONVO,
        }),
      );

      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);

      const template = {
        conversationId: Constants.NEW_CONVO as string,
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        title: localize('com_agents_chat_with', { name: agent.name || localize('com_ui_agent') }),
      };

      const currentConvo = getDefaultConversation({
        conversation: { ...(conversation ?? {}), ...template },
        preset: template,
      });

      newConversation({
        template: currentConvo,
        preset: template,
      });
    },
    [conversation, getDefaultConversation, localize, newConversation, queryClient],
  );
}
