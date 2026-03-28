function extractUnreadFromTitle(title: string): number {
  const match = title.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default extractUnreadFromTitle;
