export interface Message {
  sender: string;
  content: string;
  timestamp: bigint;
}

export interface FormattedMessage {
  sender: string;
  content: string;
  timestamp: number;
  formattedTime: string;
}
