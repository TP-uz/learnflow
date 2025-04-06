import { useState } from 'react';
import { useAIContext } from '../../context/AIContext';

const AIChat = () => {
  const [query, setQuery] = useState('');
  const { askAI, responses, isLoading } = useAIContext();

  return (
    <div className="ai-chat">
      <div className="chat-history">
        {responses.map((res, i) => (
          <div key={i} className={`message ${res.role}`}>
            {res.content}
          </div>
        ))}
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        askAI(query);
        setQuery('');
      }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask LearnFlow AI..."
        />
        <button disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Ask'}
        </button>
      </form>
    </div>
  );
};