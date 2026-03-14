import React, { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { useLocalize } from '~/hooks';
import VoiceCallScreen from './VoiceCallScreen';

interface CallButtonProps {
  hasVoice?: boolean;
  agentName?: string;
  agentAvatar?: React.ReactNode;
}

const CallButton: React.FC<CallButtonProps> = ({ hasVoice = false, agentName = '', agentAvatar }) => {
  const localize = useLocalize();
  const [inCall, setInCall] = useState(false);

  if (!hasVoice) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setInCall(true);
        }}
        className="ml-auto flex-shrink-0 rounded-full p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        aria-label={localize('com_ui_voice_call')}
        title={localize('com_ui_voice_call')}
      >
        <PhoneCall className="h-4 w-4" />
      </button>

      {inCall && (
        <VoiceCallScreen
          agentName={agentName}
          agentAvatar={agentAvatar}
          onEnd={() => setInCall(false)}
        />
      )}
    </>
  );
};

export default CallButton;
