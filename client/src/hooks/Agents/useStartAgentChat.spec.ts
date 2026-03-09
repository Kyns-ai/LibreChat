import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Constants, EModelEndpoint, LocalStorageKeys, PermissionBits, QueryKeys } from 'librechat-data-provider';
import type { Agent } from 'librechat-data-provider';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import useStartAgentChat from './useStartAgentChat';
import { useChatContext } from '~/Providers';
import useDefaultConvo from '~/hooks/Conversations/useDefaultConvo';
import useLocalize from '~/hooks/useLocalize';
import { clearMessagesCache } from '~/utils';

jest.mock('~/Providers', () => ({
  useChatContext: jest.fn(),
}));

jest.mock('~/hooks/Conversations/useDefaultConvo', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('~/hooks/useLocalize', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('~/utils', () => ({
  clearMessagesCache: jest.fn(),
}));

describe('useStartAgentChat', () => {
  const mockNewConversation = jest.fn();
  const mockGetDefaultConversation = jest.fn();
  const agent = {
    id: 'agent-123',
    name: 'Agent 123',
  } as Agent;

  const createWrapper = (queryClient: QueryClient) => {
    return ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    (useChatContext as jest.Mock).mockReturnValue({
      conversation: { conversationId: 'existing-convo' },
      newConversation: mockNewConversation,
    });
    (useDefaultConvo as jest.Mock).mockReturnValue(mockGetDefaultConversation);
    (useLocalize as jest.Mock).mockImplementation(
      () => (key: string, values?: Record<string, string>) => {
        if (key === 'com_agents_chat_with') {
          return `Chat with ${values?.name ?? ''}`;
        }

        if (key === 'com_ui_agent') {
          return 'Agent';
        }

        return key;
      },
    );
    mockGetDefaultConversation.mockReturnValue({
      conversationId: Constants.NEW_CONVO,
      endpoint: EModelEndpoint.agents,
    });
  });

  it('bootstraps a new agent conversation consistently', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const { result } = renderHook(() => useStartAgentChat(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current(agent);
    });

    expect(clearMessagesCache).toHaveBeenCalledWith(queryClient, 'existing-convo');
    expect(queryClient.getQueryData([QueryKeys.agents, { requiredPermission: PermissionBits.VIEW }]))
      .toMatchObject({
        data: [agent],
        first_id: agent.id,
        last_id: agent.id,
      });
    expect(queryClient.getQueryData([QueryKeys.agents, { requiredPermission: PermissionBits.EDIT }]))
      .toMatchObject({
        data: [agent],
        first_id: agent.id,
        last_id: agent.id,
      });

    expect(localStorage.getItem(`${LocalStorageKeys.AGENT_ID_PREFIX}0`)).toBe(agent.id);
    expect(localStorage.getItem(`${LocalStorageKeys.LAST_CONVO_SETUP}_0`)).toBe(
      JSON.stringify({
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        conversationId: Constants.NEW_CONVO,
      }),
    );

    expect(mockGetDefaultConversation).toHaveBeenCalledWith({
      conversation: {
        conversationId: Constants.NEW_CONVO,
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        title: 'Chat with Agent 123',
      },
      preset: {
        conversationId: Constants.NEW_CONVO,
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        title: 'Chat with Agent 123',
      },
    });
    expect(mockNewConversation).toHaveBeenCalledWith({
      template: {
        conversationId: Constants.NEW_CONVO,
        endpoint: EModelEndpoint.agents,
      },
      preset: {
        conversationId: Constants.NEW_CONVO,
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        title: 'Chat with Agent 123',
      },
    });
  });
});
