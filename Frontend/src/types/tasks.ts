export type Priority = 'low' | 'medium' | 'high'

export type Task = {
  id: string
  title: string
  shared: boolean
  description: string | null
  due_date: string | null
  priority: Priority
  completed: boolean
  created_at: string
  completed_at?: string | null
  category: string | null
  order: number
  assigned_to?: string | null
  assigned_email?: string | null
  created_by?: string | null
  collaborators?: string[]
}

