const QUOTES = [
  '每天进步一点点',
  '自律给我自由',
  '汗水不会骗人',
  '今天的努力,是明天的实力',
  '坚持就是胜利',
  '没有不劳而获的身材',
  '比昨天更强一点',
  '身体是最诚实的记录者',
  '慢慢来,但别停下',
  '你在为自己拼一次',
]

// 同一天多次查看结果一致,不同天会换一句
export function quoteForDate(date: string): string {
  let hash = 0
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 31 + date.charCodeAt(i)) >>> 0
  }
  return QUOTES[hash % QUOTES.length]
}
