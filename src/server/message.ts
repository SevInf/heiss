export const enum MessageType {
    CHANGE = 'change'
}

export interface Message {
    type: MessageType.CHANGE;
    url: string;
    mtime: number;
}
