'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, TrendingUp, Users, BarChart3, AlertCircle } from 'lucide-react';
import analyticsAPI from '@/lib/analytics-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp: Date;
}

interface SuggestedQuery {
  text: string;
  icon: React.ReactNode;
  category: 'sla' | 'fleet' | 'routes' | 'demand';
}

const SUGGESTED_QUERIES: SuggestedQuery[] = [
  {
    text: 'What is the current SLA status?',
    icon: <AlertCircle className="h-4 w-4" />,
    category: 'sla',
  },
  {
    text: 'Show me driver performance trends',
    icon: <Users className="h-4 w-4" />,
    category: 'fleet',
  },
  {
    text: 'Analyze route efficiency for last 30 days',
    icon: <TrendingUp className="h-4 w-4" />,
    category: 'routes',
  },
  {
    text: 'What is the demand forecast for next week?',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'demand',
  },
];

export function AnalyticsGPTChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content:
        'Hello! I can help you analyze your fleet data. Ask me about SLA status, driver performance, route efficiency, or demand forecasting.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await analyticsAPI.queryGPT(messageText);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.response,
        data: response.data,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please make sure the analytics service is running.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuery = (query: string) => {
    handleSendMessage(query);
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Card className="flex flex-col h-[600px] p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">GPT Analytics Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Ask questions about your fleet operations in natural language
        </p>
      </div>

      {/* Suggested Queries - Only show when no user messages */}
      {messages.filter((m) => m.type === 'user').length === 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Suggested queries:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SUGGESTED_QUERIES.map((query, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedQuery(query.text)}
                className="flex items-center gap-2 p-3 text-sm text-left border rounded-lg hover:bg-accent transition-colors"
                disabled={isLoading}
              >
                {query.icon}
                <span>{query.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* Display data visualizations if available */}
                {message.data && (
                  <div className="mt-3 p-3 bg-background/50 rounded border">
                    <p className="text-xs font-medium mb-2">Data Preview:</p>
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(message.data, null, 2).slice(0, 200)}
                      {JSON.stringify(message.data, null, 2).length > 200 && '...'}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      View full data in the analytics dashboard
                    </p>
                  </div>
                )}

                <p className="text-xs opacity-70 mt-2">{formatTimestamp(message.timestamp)}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-4 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm">Analyzing data...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Ask about SLA, drivers, routes, or demand..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          onClick={() => handleSendMessage()}
          disabled={isLoading || !input.trim()}
          size="icon"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Export Chat History */}
      <div className="mt-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const chatHistory = messages
              .map(
                (m) =>
                  `[${formatTimestamp(m.timestamp)}] ${m.type === 'user' ? 'You' : 'Assistant'}: ${m.content}`
              )
              .join('\n\n');
            const blob = new Blob([chatHistory], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-chat-${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export Chat History
        </Button>
      </div>
    </Card>
  );
}
