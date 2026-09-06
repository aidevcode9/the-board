# Interfaces reference

Extracted from the existing architecture specification. These are design-contract examples; source remains the implementation evidence. This documentation change does not alter any frozen interface.

[Architecture index](../../ARCHITECTURE.md)

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/[...nextauth]` | * | Public | NextAuth.js handlers (Google OAuth, session) |
| `/api/auth/beta-code` | POST | Public | Validate beta invite code |
| `/api/debate` | POST | User | Start debate and return SSE stream (`PHASE2-CONTRACT.md`; client uses `fetch()` reader) |
| `/api/quick` | POST | User | Quick mode (single model, fast) |
| `/api/workspaces` | GET/POST | User | List/create workspaces |
| `/api/workspaces/[id]/debates` | GET | User | List debates for workspace |
| `/api/debates/[id]` | GET | User | Get debate with transcript |
| `/api/golden-sets` | GET/POST | User (POST needs admin approval) | List/create golden set entries |
| `/api/eval/run` | POST | Admin | Trigger eval run against golden set |
| `/api/admin/providers` | GET/POST/PUT | Admin | CRUD provider configurations |
| `/api/admin/providers/[id]/test` | POST | Admin | Test provider connection |
| `/api/admin/providers/models` | GET | Admin | List models for a provider |
| `/api/admin/persona-mappings` | GET/POST/PUT | Admin | Map personas to provider models |
| `/api/admin/persona-mappings/presets` | GET | Admin | List presets (Frontier/Budget/Free/Custom) |
| `/api/admin/users` | GET/PUT | Admin | List users, change roles |
| `/api/admin/beta-codes` | GET/POST | Admin | Generate/list invite codes |

---

## Key Interfaces

### Traced LLM Client
```typescript
// src/lib/providers/traced.ts
// ALL model calls go through this. No exceptions.
interface TracedLLMCall {
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  messages: Message[];
  metadata: {
    debateId: string;
    phase: DebatePhase;
    persona: string;
    mode: DebateMode;
    domain: string;
  };
}
```

### Persona Interface
```typescript
// src/lib/personas/types.ts
interface Persona {
  id: 'analyst' | 'builder' | 'synthesizer';
  model: ModelId;
  provider: 'anthropic' | 'openai' | 'google';
  systemPrompt: string;              // Includes anti-sycophancy clause
  adversarialStyle: string;
  strengths: string[];
  reviewInstructions: string;        // How to critique others
  synthesisInstructions: string;     // How to synthesize (when in Lead role)
}
```

### Provider Config Interface
```typescript
// src/lib/providers/config.ts
interface ProviderConfig {
  id: string;
  name: string;
  sdkType: 'anthropic' | 'openai' | 'google';  // DeepSeek, Groq, LM Studio all use 'openai'
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
}

interface PersonaMapping {
  presetName: 'frontier' | 'budget' | 'free' | 'custom';
  analyst: { providerId: string; modelId: string };
  builder: { providerId: string; modelId: string };
  synthesizer: { providerId: string; modelId: string };
}

// Runtime: resolve active persona mapping to callable clients
function getPersonaClients(presetName: string): {
  analyst: TracedLLMClient;
  builder: TracedLLMClient;
  synthesizer: TracedLLMClient;
}
```

---
