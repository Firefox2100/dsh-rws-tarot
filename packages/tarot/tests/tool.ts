import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'

/** One model tool call, run through the mounted executor the way the agent loop runs a batch of one. */
export async function callTool(ctx: Context, agent: Agent, name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const call = { type: 'tool-call', id: ToolCallId('call'), name, arguments: JSON.stringify(args) } as const
  const batch = await ctx.tools.execute({ calls: [call], signal: new AbortController().signal, agent })
  return batch.results[0]!.result
}
