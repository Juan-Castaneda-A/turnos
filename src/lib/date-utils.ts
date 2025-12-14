export const getDateRange = (range: 'today' | 'week' | 'month' | 'all') => {
  const today = new Date()
  const end = today.toISOString().split('T')[0]
  let start = ''

  switch (range) {
    case 'today':
      start = end
      break
    case 'week':
      const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1)) // Lunes
      start = firstDayOfWeek.toISOString().split('T')[0]
      break
    case 'month':
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      start = firstDayOfMonth.toISOString().split('T')[0]
      break
    case 'all':
      start = '2023-01-01' // Fecha arbitraria de inicio del sistema
      break
  }
  return { start, end }
}