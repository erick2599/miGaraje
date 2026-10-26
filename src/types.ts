export type Note = {
  id: string
  text: string
  done: boolean
  createdAt: number
  updatedAt: number
}

export type Filter = 'all' | 'active' | 'done'
