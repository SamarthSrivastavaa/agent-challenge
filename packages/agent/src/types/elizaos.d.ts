/**
 * Ambient type declarations for @elizaos/core
 *
 * This declaration file defines the ElizaOS types used throughout the
 * SovereignSelf agent. It provides a stable type surface regardless of
 * which version of @elizaos/core is installed, ensuring the project
 * compiles cleanly even when the actual package's exports differ from
 * what our code expects.
 *
 * These types match the public ElizaOS v2 plugin API.
 */
declare module "@elizaos/core" {
  // ── Core runtime interface ──

  export interface IAgentRuntime {
    agentId?: string;
    character?: Character;
    plugins?: Plugin[];
    providers?: Provider[];
    actions?: Action[];
    evaluators?: Evaluator[];
    getSetting?(key: string): string | undefined;
    [key: string]: unknown;
  }

  // ── Message and state types ──

  export interface Memory {
    id?: string;
    userId?: string;
    agentId?: string;
    roomId?: string;
    content: Content | string;
    embedding?: number[];
    createdAt?: number;
    [key: string]: unknown;
  }

  export interface Content {
    text?: string;
    action?: string;
    source?: string;
    [key: string]: unknown;
  }

  export type State = Record<string, unknown> | undefined;

  // ── Plugin system types ──

  export interface Plugin {
    name: string;
    description: string;
    actions?: Action[];
    providers?: Provider[];
    evaluators?: Evaluator[];
    [key: string]: unknown;
  }

  export interface Action {
    name: string;
    description: string;
    similes?: string[];
    examples?: unknown[];
    validate?: (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
    ) => Promise<boolean>;
    handler: (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
      options?: Record<string, unknown>,
      callback?: HandlerCallback,
    ) => Promise<void>;
  }

  export interface Provider {
    get: (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
    ) => Promise<string>;
  }

  export interface Evaluator {
    name: string;
    description: string;
    alwaysRun?: boolean;
    examples?: unknown[];
    validate?: (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
    ) => Promise<boolean>;
    handler: (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
    ) => Promise<void>;
  }

  export type HandlerCallback = (response: {
    text: string;
    action?: string;
    [key: string]: unknown;
  }) => void;

  // ── Character definition ──

  export interface Character {
    name: string;
    bio?: string[];
    lore?: string[];
    messageExamples?: Array<Array<{ user: string; content: { text: string } }>>;
    postExamples?: string[];
    topics?: string[];
    adjectives?: string[];
    style?: {
      all?: string[];
      chat?: string[];
      post?: string[];
    };
    settings?: {
      model?: string;
      [key: string]: unknown;
    };
    system?: string;
    modelProvider?: string;
    [key: string]: unknown;
  }

  // ── Agent runtime class ──

  export class AgentRuntime implements IAgentRuntime {
    constructor(config: Record<string, unknown>);
    character?: Character;
    plugins?: Plugin[];
    providers?: Provider[];
    actions?: Action[];
    evaluators?: Evaluator[];
    agentId?: string;
    start?(): Promise<void>;
    stop?(): Promise<void>;
    getSetting?(key: string): string | undefined;
    [key: string]: unknown;
  }
}
