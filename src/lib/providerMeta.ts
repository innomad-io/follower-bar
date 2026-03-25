export function providerLabel(provider: string) {
  switch (provider) {
    case "x":
      return "X";
    case "youtube":
      return "YouTube";
    case "bilibili":
      return "Bilibili";
    case "xiaohongshu":
      return "Xiaohongshu";
    case "douyin":
      return "Douyin";
    case "threads":
      return "Threads";
    case "instagram":
      return "Instagram";
    case "zhihu":
      return "Zhihu";
    case "wechat":
      return "WeChat";
    default:
      return provider;
  }
}
