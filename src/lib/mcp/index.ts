export { createMcpServer, MCP_SERVER_NAME, MCP_SERVER_VERSION } from './server';

export {
  EVAL_SCORE_THRESHOLD,
  KNOWN_SECTIONS,
  executeUpdateKnowledge,
  updateKnowledgeInputSchema,
  updateKnowledgeOutputSchema,
} from './tools/update-knowledge';

export type {
  KnownSection,
  UpdateKnowledgeInput,
  UpdateKnowledgeResult,
} from './tools/update-knowledge';
