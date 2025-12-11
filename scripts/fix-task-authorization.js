// 任务队列授权问题修复脚本
// 使用Supabase JavaScript客户端直接操作数据库

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://crndpzhpvhcncoscoiba.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNybmRwenhodmhobmNvc2NvaWJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDAwODUxNywiZXhwIjoyMDQ5NTg0NTE3fQ.Mg4UKokQRWkzZQK1L5YAw0yfTBw7A6bLo3YjKb_JnNk'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function fixTaskQueue() {
  console.log('🔧 开始修复任务队列问题...')

  try {
    // 1. 查看当前任务状态
    console.log('\n📊 当前任务状态:')
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, status, task_type, retry_count, created_at, updated_at')
      .in('id', [
        '5bb97fc4-efe1-4d95-b48d-04b42aee0892',
        '60aed9e9-92df-49ca-afbe-256fc69d1ddb'
      ])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('查询任务失败:', error)
      return
    }

    console.log('找到任务:', tasks)

    // 2. 修复每个任务
    for (const task of tasks) {
      console.log(`\n🔄 修复任务: ${task.id}`)
      console.log(`  状态: ${task.status} → queued`)

      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          status: 'queued',
          worker_id: null,
          started_at: null,
          timeout_at: null,
          retry_count: 0,
          last_error: null,
          priority: 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id)

      if (updateError) {
        console.error(`  ❌ 修复失败:`, updateError)
      } else {
        console.log(`  ✅ 修复成功`)
      }
    }

    // 3. 重置所有卡住的任务
    console.log('\n🔍 查找卡住的任务...')
    const { data: stuckTasks, error: stuckError } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

    if (stuckError) {
      console.error('查找卡住任务失败:', stuckError)
    } else {
      console.log(`找到 ${stuckTasks.length} 个卡住的任务`)

      for (const stuckTask of stuckTasks) {
        const { error: resetError } = await supabase
          .from('tasks')
          .update({
            status: 'queued',
            worker_id: null,
            started_at: null,
            timeout_at: null,
            retry_count: supabase.sql`coalesce(retry_count, 0) + 1`,
            last_error: 'Auto-recovered from stuck processing state',
            updated_at: new Date().toISOString()
          })
          .eq('id', stuckTask.id)

        if (resetError) {
          console.error(`  ❌ 重置任务 ${stuckTask.id} 失败:`, resetError)
        } else {
          console.log(`  ✅ 重置任务 ${stuckTask.id} 成功`)
        }
      }
    }

    // 4. 显示最终状态
    console.log('\n📈 最终任务统计:')
    const { data: finalStats } = await supabase
      .from('tasks')
      .select('status')
      .then(({ data }) => {
        const counts = {}
        data.forEach(task => {
          counts[task.status] = (counts[task.status] || 0) + 1
        })
        return counts
      })

    console.log('任务统计:', finalStats)

    console.log('\n✅ 任务队列修复完成!')
    console.log('💡 请检查 GitHub Actions 是否正常运行')
    console.log('💡 请访问 http://localhost:3000/tasks 查看任务状态')

  } catch (error) {
    console.error('修复过程中出错:', error)
  }
}

// 运行修复
fixTaskQueue()