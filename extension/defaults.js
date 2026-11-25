// Starting layout. Everything here can be changed from the page itself
// (Edit and Settings), so you never need to touch this file.
window.FORGE_DEFAULTS = {
  version: 1,
  groups: [
    {
      id: "g-daily", name: "Every day", color: "blue",
      tiles: [
        { id: "t-gmail", name: "Gmail", url: "https://mail.google.com", icon: { type: "auto" } },
        { id: "t-cal", name: "Calendar", url: "https://calendar.google.com", icon: { type: "auto" } },
        { id: "t-drive", name: "Drive", url: "https://drive.google.com", icon: { type: "auto" } },
        { id: "t-maps", name: "Maps", url: "https://maps.google.com", icon: { type: "auto" } },
        { id: "t-yt", name: "YouTube", url: "https://www.youtube.com", icon: { type: "auto" } }
      ]
    },
    {
      id: "g-ai", name: "AI", color: "violet",
      tiles: [
        { id: "t-claude", name: "Claude", url: "https://claude.ai", icon: { type: "auto" } },
        { id: "t-chatgpt", name: "ChatGPT", url: "https://chatgpt.com", icon: { type: "auto" } },
        { id: "t-gemini", name: "Gemini", url: "https://gemini.google.com", icon: { type: "auto" } },
        { id: "t-perplexity", name: "Perplexity", url: "https://www.perplexity.ai", icon: { type: "auto" } }
      ]
    },
    {
      id: "g-work", name: "Work", color: "bronze",
      tiles: [
        { id: "t-github", name: "GitHub", url: "https://github.com", icon: { type: "auto" } },
        { id: "t-notion", name: "Notion", url: "https://www.notion.so", icon: { type: "auto" } },
        { id: "t-slack", name: "Slack", url: "https://app.slack.com", icon: { type: "auto" } },
        { id: "t-linkedin", name: "LinkedIn", url: "https://www.linkedin.com", icon: { type: "auto" } }
      ]
    },
    {
      id: "g-reading", name: "Reading", color: "teal",
      tiles: [
        { id: "t-wiki", name: "Wikipedia", url: "https://en.wikipedia.org", icon: { type: "auto" } },
        { id: "t-reddit", name: "Reddit", url: "https://www.reddit.com", icon: { type: "auto" } },
        { id: "t-hn", name: "Hacker News", url: "https://news.ycombinator.com", icon: { type: "auto" } }
      ]
    }
  ],
  // Words in single braces, like {container}, are asked for when you copy.
  commands: [
    { id: "k-ip", name: "Show my network addresses", cmd: "ipconfig", where: "windows" },
    { id: "k-dns", name: "Clear the DNS cache", cmd: "ipconfig /flushdns", where: "windows" },
    { id: "k-port-win", name: "What is using a port", cmd: "netstat -ano | findstr :{port}", where: "windows" },
    { id: "k-apps", name: "List every app in the Start menu", cmd: "Get-StartApps", where: "windows" },
    { id: "k-port-nix", name: "What is using a port", cmd: "sudo lsof -i :{port}", where: "server" },
    { id: "k-disk", name: "Free disk space", cmd: "df -h", where: "server" },
    { id: "k-ps", name: "See which Docker containers are running", cmd: "docker ps --format '{{.Names}}  {{.Status}}'", where: "server" },
    { id: "k-logs", name: "Watch a container's log", cmd: "docker logs -f --tail 100 {container}", where: "server" },
    { id: "k-ssh", name: "Connect to a server", cmd: "ssh {user}@{host}", where: "any" },
    { id: "k-undo", name: "Git: undo the last commit, keep the changes", cmd: "git reset --soft HEAD~1", where: "any" }
  ],
  checks: [],
  notes: [
    {
      id: "n-welcome", pinned: true, color: "blue", updated: 0,
      text: "Welcome to Forge Tab\n\n- Start typing anywhere to open a shortcut or search the web.\n- Click Edit to add, drag, group and rename shortcuts.\n- Commands keeps terminal commands you copy with one click.\n- Settings adds status checks for your sites and backs up your layout.\n\nDelete this note whenever you like."
    }
  ]
};
