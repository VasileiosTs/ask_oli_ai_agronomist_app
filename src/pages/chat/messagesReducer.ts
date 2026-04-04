import type { Message } from '../../components/MessageList';

export type MsgAction =
  | { type: 'set'; messages: Message[] }
  | { type: 'clear' }
  | { type: 'append'; message: Message }
  | { type: 'set_if_empty'; message: Message }
  | { type: 'update'; id: string; patch: Partial<Message> }
  | { type: 'replace'; id: string; message: Message }
  | { type: 'update_by'; predicate: (m: Message) => boolean; patch: Partial<Message> }
  | { type: 'filter'; predicate: (m: Message) => boolean }
  | { type: 'batch_update'; updates: Array<{ id: string; patch: Partial<Message> }> };

export function messagesReducer(state: Message[], action: MsgAction): Message[] {
  switch (action.type) {
    case 'set':
      return action.messages;
    case 'clear':
      return [];
    case 'append':
      return [...state, action.message];
    case 'set_if_empty':
      return state.length === 0 ? [action.message] : state;
    case 'update':
      return state.map((message) => (
        message.id === action.id ? { ...message, ...action.patch } : message
      ));
    case 'replace':
      return state.map((message) => (
        message.id === action.id ? action.message : message
      ));
    case 'update_by':
      return state.map((message) => (
        action.predicate(message) ? { ...message, ...action.patch } : message
      ));
    case 'filter':
      return state.filter(action.predicate);
    case 'batch_update': {
      const patchMap = new Map(action.updates.map((update) => [update.id, update.patch]));
      return state.map((message) => {
        const patch = patchMap.get(message.id);
        return patch ? { ...message, ...patch } : message;
      });
    }
    default:
      return state;
  }
}
