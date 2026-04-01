/**
 * Supabase Checkpoint Saver para LangGraph
 *
 * Persiste el estado completo del grafo en Supabase,
 * permitiendo reanudar ejecuciones interrumpidas.
 */

import { BaseCheckpointSaver, type Checkpoint, type CheckpointMetadata, type CheckpointTuple } from '@langchain/langgraph';

type PendingWrite = [string, unknown];
import type { RunnableConfig } from '@langchain/core/runnables';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class SupabaseCheckpointSaver extends BaseCheckpointSaver {
  private sb: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    super();
    this.sb = createClient(supabaseUrl, serviceRoleKey);
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) return undefined;

    const checkpointId = config.configurable?.checkpoint_id as string | undefined;

    let query = this.sb
      .from('lg_checkpoints')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkpointId) {
      query = query.eq('checkpoint_id', checkpointId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return undefined;

    return {
      config: {
        configurable: {
          thread_id: data.thread_id,
          checkpoint_id: data.checkpoint_id,
        },
      },
      checkpoint: data.checkpoint as Checkpoint,
      metadata: data.metadata as CheckpointMetadata,
      parentConfig: data.parent_checkpoint_id
        ? {
            configurable: {
              thread_id: data.thread_id,
              checkpoint_id: data.parent_checkpoint_id,
            },
          }
        : undefined,
    };
  }

  async *list(
    config: RunnableConfig,
    options?: { limit?: number; before?: RunnableConfig },
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined;
    if (!threadId) return;

    const limit = options?.limit ?? 10;
    const { data } = await this.sb
      .from('lg_checkpoints')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    for (const row of data ?? []) {
      yield {
        config: {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint: row.checkpoint as Checkpoint,
        metadata: row.metadata as CheckpointMetadata,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: Record<string, number | string>,
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointId = checkpoint.id;
    const parentCheckpointId = config.configurable?.checkpoint_id as string | undefined;

    await this.sb.from('lg_checkpoints').upsert({
      thread_id: threadId,
      checkpoint_id: checkpointId,
      parent_checkpoint_id: parentCheckpointId ?? null,
      checkpoint,
      metadata,
    }, { onConflict: 'thread_id,checkpoint_id' });

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_id: checkpointId,
      },
    };
  }

  async deleteThread(threadId: string): Promise<void> {
    await Promise.all([
      this.sb.from('lg_checkpoints').delete().eq('thread_id', threadId),
      this.sb.from('lg_checkpoint_writes').delete().eq('thread_id', threadId),
    ]);
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointId = config.configurable?.checkpoint_id as string;

    if (!threadId || !checkpointId) return;

    await this.sb.from('lg_checkpoint_writes').insert(
      writes.map(([channel, value]) => ({
        thread_id: threadId,
        checkpoint_id: checkpointId,
        task_id: taskId,
        channel,
        value,
      })),
    );
  }
}
