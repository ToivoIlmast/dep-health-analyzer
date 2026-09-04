import { CommandType } from './types';

export const commands: CommandType[] = ['cycles', 'regression', 'history'];

export function isCommand(value: string): value is CommandType {
    return commands.includes(value as CommandType);
}
