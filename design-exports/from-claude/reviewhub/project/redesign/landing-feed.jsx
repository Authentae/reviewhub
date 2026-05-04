// landing-feed.jsx — animated live review feed for the hero

const FEED_ITEMS = [
  {
    name: "Marco P.",
    plat: "Google",
    stars: 5,
    body: "Barista remembered my order after one visit. That's a 5. Pour-over machine was broken though.",
    draft: "Appreciate you stopping by, Marco — pour-over's back Thursday. See you then.",
    ago: "2m"
  },
  {
    name: "Ploy S.",
    plat: "Wongnai",
    stars: 5,
    body: "ร้านน่ารักมาก บรรยากาศดี กาแฟอร่อย จะกลับมาอีกแน่นอน 🇹🇭",
    draft: "ขอบคุณมากค่ะคุณพลอย รอพบคุณอีกครั้งค่ะ ☕",
    ago: "6m"
  },
  {
    name: "Jamie R.",
    plat: "Yelp",
    stars: 4,
    body: "Solid croissants, a bit slow on a Saturday. Would still come back.",
    draft: "Thanks Jamie — we've added a second oven for weekends. Try us again.",
    ago: "11m"
  },
  {
    name: "Fatima A.",
    plat: "TripAdvisor",
    stars: 5,
    body: "Found this place walking back from the temple. Iced latte saved the afternoon.",
    draft: "So glad we were on your route, Fatima. Safe travels!",
    ago: "23m"
  },
  {
    name: "Sven K.",
    plat: "Trustpilot",
    stars: 3,
    body: "Food was good but the wifi kept dropping — I was there to work.",
    draft: "Appreciate the feedback, Sven — router's being replaced this week. Come back and test it on us.",
    ago: "34m"
  },
  {
    name: "Dao N.",
    plat: "Facebook",
    stars: 5,
    body: "Vibes immaculate. The playlist alone earned a star.",
    draft: "Ha — thank you, Dao. Playlist's on Spotify under \"Morning Shift.\"",
    ago: "48m"
  }
];

function StarRow({ n }) {
  const S = window.Star;
  return (
    <span className="stars">
      {Array.from({ length: 5 }).map((_, i) => <S key={i} filled={i < n} />)}
    </span>
  );
}

function ReviewRow({ item, isNew }) {
  const initials = item.name.split(" ").map(s => s[0]).join("").slice(0, 2);
  return (
    <div className={"review" + (isNew ? " new" : "")}>
      <div className="r-head">
        <div className="who">
          <div className="avatar">{initials}</div>
          <div className="name">{item.name}</div>
          <StarRow n={item.stars} />
        </div>
        <div className="plat">{item.plat} · {item.ago}</div>
      </div>
      <div className="body">"{item.body}"</div>
      <div className="reply-draft">
        <span className="label">AI Draft</span>
        <span>{item.draft}</span>
      </div>
    </div>
  );
}

function LiveFeed() {
  // Cycle: show 3 at a time; every ~3.5s rotate (new item on top)
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setOffset(o => (o + 1) % FEED_ITEMS.length), 3500);
    return () => clearInterval(id);
  }, []);
  const visible = [];
  for (let i = 0; i < 3; i++) {
    visible.push(FEED_ITEMS[(offset + i) % FEED_ITEMS.length]);
  }
  return (
    <div className="feed-frame">
      <div className="feed-head">
        <div className="title">
          <span className="live">LIVE</span>
          <span>Today's inbox</span>
        </div>
        <span className="mono">{FEED_ITEMS.length - 1} unresponded</span>
      </div>
      <div className="feed">
        {visible.map((it, i) => (
          <ReviewRow key={`${offset}-${i}-${it.name}`} item={it} isNew={i === 0} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { LiveFeed });
