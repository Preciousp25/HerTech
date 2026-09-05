const navItems = [
  "Overview",
  "Messages",
  "Groups",
  "Calls",
  "Bookmarks",
  "Settings",
];

const stats = [
  { label: "Active chats", value: "128", tone: "bg-violet-100 text-violet-700" },
  { label: "New this week", value: "24", tone: "bg-sky-100 text-sky-700" },
  { label: "Avg. response", value: "2m", tone: "bg-emerald-100 text-emerald-700" },
];

const conversations = [
  { name: "Amara N", message: "The launch deck is ready for review.", time: "2m ago", active: true },
  { name: "Daniel K", message: "I shared the onboarding notes earlier.", time: "12m ago" },
  { name: "Lina P", message: "Can we reschedule the demo for Friday?", time: "1h ago" },
  { name: "Team Alpha", message: "Design feedback is in the shared board.", time: "3h ago" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-200 bg-white/80 p-6 backdrop-blur-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 font-bold text-white">
              D
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Workspace</p>
              <h1 className="text-xl font-semibold">DuuKaTalk</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item, index) => (
              <button
                key={item}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  index === 1
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span>{item}</span>
                {index === 1 && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">8</span>}
              </button>
            ))}
          </nav>

          <div className="mt-10 rounded-2xl bg-slate-900 p-4 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Team pulse</p>
            <p className="mt-3 text-3xl font-semibold">92%</p>
            <p className="mt-1 text-sm text-slate-300">Engagement this week</p>
          </div>
        </aside>

        <main className="flex-1 p-8">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Dashboard</p>
              <h2 className="mt-1 text-3xl font-semibold">Good evening, Precious</h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                Search conversations
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 font-semibold text-white">
                P
              </div>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${stat.tone}`}>
                  {stat.label}
                </div>
                <p className="mt-5 text-3xl font-bold">{stat.value}</p>
              </div>
            ))}
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Recent conversations</h3>
                <button className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">View all</button>
              </div>

              <div className="space-y-3">
                {conversations.map((chat) => (
                  <div
                    key={chat.name}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                      chat.active ? "bg-violet-50" : "bg-slate-50"
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700">
                      {chat.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-800">{chat.name}</p>
                        <span className="text-xs text-slate-400">{chat.time}</span>
                      </div>
                      <p className="truncate text-sm text-slate-500">{chat.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Today</h3>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-violet-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-500">Meeting</p>
                  <p className="mt-2 text-lg font-semibold">Product sync</p>
                  <p className="text-sm text-violet-700">10:30 AM · Zoom</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reminder</p>
                  <p className="mt-2 text-lg font-semibold">Design review</p>
                  <p className="text-sm text-slate-600">2:00 PM · Boardroom</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
