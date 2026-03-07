import React, { useMemo, useState } from 'react';
import { isAgentsEndpoint } from 'librechat-data-provider';
import { OGDialog, OGDialogTrigger } from '@librechat/client';
import type { TConversation } from 'librechat-data-provider';
import AgentDetailContent from '~/components/Agents/AgentDetailContent';
import { useAgentsMapContext } from '~/Providers/AgentsMapContext';
import { renderAgentAvatar } from '~/utils';

interface AgentChatHeaderProps {
  conversation: TConversation | null;
}

const AgentChatHeader: React.FC<AgentChatHeaderProps> = ({ conversation }) => {
  const agentsMap = useAgentsMapContext();
  const [isOpen, setIsOpen] = useState(false);

  const agent = useMemo(() => {
    if (!conversation?.agent_id || !isAgentsEndpoint(conversation.endpoint)) {
      return null;
    }
    return agentsMap?.[conversation.agent_id] ?? null;
  }, [conversation?.agent_id, conversation?.endpoint, agentsMap]);

  if (!agent) {
    return null;
  }

  return (
    <OGDialog open={isOpen} onOpenChange={setIsOpen}>
      <OGDialogTrigger asChild>
        <button
          type="button"
          className="sticky top-14 z-20 mx-auto flex w-full max-w-3xl cursor-pointer items-center gap-3 bg-surface-primary/80 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-surface-hover"
          aria-label={`Ver detalhes de ${agent.name}`}
        >
          <div className="flex-shrink-0 overflow-hidden rounded-full shadow-md">
            {renderAgentAvatar(agent, { size: 'sm', showBorder: false })}
          </div>
          <div className="flex flex-col items-start overflow-hidden">
            <span className="truncate text-base font-semibold text-text-primary">{agent.name}</span>
            {agent.description && (
              <span className="truncate text-sm text-text-secondary">{agent.description}</span>
            )}
          </div>
        </button>
      </OGDialogTrigger>
      <AgentDetailContent agent={agent} />
    </OGDialog>
  );
};

export default AgentChatHeader;
