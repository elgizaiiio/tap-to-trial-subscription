# Agent model distribution

One sequential execution loop chooses a model for each step; this is not parallel independent agents. The existing context, tool results, approvals and ownership checks stay shared. Only CoArena is primary; every chain ultimately falls back to Cerebras Qwen, never gpt-oss.

| Work | First CoArena model | CoArena backups |
|---|---|---|
| Large task planning and final synthesis | gpt-6-1-terra | gemini-4-carbon |
| Ordinary conversation/simple operations | gpt-6-luna | gpt-6-1-sol |
| Web, browsing, research and Apify | gpt-6-1-sol | grok-4-7 → gpt-6-1-terra |
| Code, Python and files | gemini-4-carbon | gpt-6-1-terra |
| Photos/screenshots | gemini-4-carbon | gpt-6-1-terra |

These are existing configured provider identifiers, not independently proven benchmark rankings. This pass adds Apify classification and preserves the owner's choices; it does not assert availability of Claude or invent new model names. Model unavailability is handled by the existing adapter's ordered fallback. Images take precedence over previous code/web tools except large-task opening/final steps. Task classification remains heuristic; it is not an LLM planner or a guarantee of task completion.

Apify access is dynamic: search the live Store, inspect the latest Actor build's input schema and price, start a bounded job, check terminal status, then read paginated results. Only Actors actually accessible to the account can execute; their subscription, billing and input requirements still apply. No claim is made that the catalogue contains a million tools. All Actor metadata and results are untrusted data, not agent instructions.