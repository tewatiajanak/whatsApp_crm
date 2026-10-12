// Site apps: installable feature kits. Each kit is a set of collections with sample
// records, a list page and an item page ("/blog/:slug"), built from normal elements.
import { createNode } from "./registry";
import "./elements2";

const n = (type, props = {}, children = [], extra = {}) => ({ ...createNode(type, props, children), ...extra });
const pageJson = (children) => ({ schemaVersion: 2, settings: {}, root: { id: "root", type: "Page", props: {}, children } });
const f = (key, label, type = "text", extra = {}) => ({ key, label, type, ...extra });

/** A list page: heading, then one card per record, with search and paging. */
function listPage(title, intro, source, card, sort = "-publishedAt") {
  return pageJson([
    n("Navbar"),
    n("Hero", { layout: "center", tone: "soft", eyebrow: "", heading: title, text: intro, primaryLabel: "", secondaryLabel: "" }),
    n("Section", {}, [n("Repeater", { columns: 3, showSearch: true }, [n("ImageCard", card)], { repeat: { source, limit: 9, sort, paginate: true } })]),
    n("Footer"),
  ]);
}
/** An item page: the record's own fields, bound with {{ item.* }}. */
function itemPage(backLabel, backHref, body) {
  return pageJson([
    n("Navbar"),
    n("Section", {}, [n("Breadcrumbs"), n("Spacer", { height: 16 }), ...body, n("Spacer", { height: 24 }), n("Button", { label: `← ${backLabel}`, href: backHref, variant: "outline" })]),
    n("Footer"),
  ]);
}
const days = (d) => new Date(Date.now() + d * 86_400_000).toISOString();

export const SITE_APPS = [
  {
    key: "blog", name: "Blog", icon: "BookOpen", description: "Articles with a list page, search and a page for every post.",
    build: () => ({
      collections: [{ key: "posts", name: "Posts", settings: { titleField: "title", apiEnabled: true, appKey: "blog" }, fields: [f("title", "Title", "text", { required: true }), f("excerpt", "Excerpt", "textarea"), f("cover", "Cover image", "image"), f("body", "Body", "richtext"), f("author", "Author"), f("category", "Category", "select", { options: ["News", "Guides", "Stories"] }), f("tags", "Tags", "tags")] }],
      records: { posts: [
        { title: "Welcome to our blog", excerpt: "What you can expect to read here.", body: "<p>This is your first post. Edit it or add a new one from Content → Posts.</p>", author: "Team", category: "News", tags: ["welcome"] },
        { title: "Five tips to get started", excerpt: "A short, practical guide.", body: "<p>Share useful advice with your readers.</p><ul><li>Keep it short</li><li>Use examples</li></ul>", author: "Team", category: "Guides", tags: ["tips"] },
        { title: "A story from our community", excerpt: "People are at the heart of what we do.", body: "<p>Tell a real story about a customer, student or team member.</p>", author: "Team", category: "Stories", tags: ["community"] },
      ] },
      pages: [
        { title: "Blog", path: "/blog", content: listPage("Blog", "News, guides and stories.", "collection:posts", { image: "{{ item.cover }}", eyebrow: "{{ item.category }}", title: "{{ item.title }}", text: "{{ item.excerpt | truncate:120 }}", href: "{{ item.url }}", linkLabel: "Read more" }) },
        { title: "Blog post", path: "/blog/:slug", collectionKey: "posts", content: itemPage("All posts", "/blog", [n("Eyebrow", { text: "{{ item.category }}" }), n("Heading", { text: "{{ item.title }}", level: "h1" }), n("Text", { text: "{{ item.author }} · {{ item.publishedAt | date:\"dd mmm yyyy\" }}" }), n("Image", { src: "{{ item.cover }}", alt: "{{ item.title }}" }, [], { conditions: { match: "all", rules: [{ left: "{{ item.cover }}", op: "notEmpty", right: "" }] } }), n("RichText", { html: "{{ item.body }}" })]) },
      ],
    }),
  },
  {
    key: "events", name: "Events", icon: "Clock", description: "Upcoming events with dates, venue and a page for each event.",
    build: () => ({
      collections: [{ key: "events", name: "Events", settings: { titleField: "title", apiEnabled: true, appKey: "events" }, fields: [f("title", "Title", "text", { required: true }), f("startsAt", "Starts", "date", { required: true }), f("venue", "Venue"), f("summary", "Summary", "textarea"), f("cover", "Cover image", "image"), f("details", "Details", "richtext"), f("price", "Price", "number"), f("registerUrl", "Registration link", "url")] }],
      records: { events: [
        { title: "Open day", startsAt: days(14), venue: "Main campus", summary: "Meet the team and take a tour.", details: "<p>Everyone is welcome. Tours start every hour.</p>", price: 0 },
        { title: "Annual meet-up", startsAt: days(40), venue: "City hall", summary: "A full day of talks and networking.", details: "<p>Agenda, speakers and timings go here.</p>", price: 499 },
        { title: "Weekend workshop", startsAt: days(60), venue: "Studio 2", summary: "Hands-on learning in a small group.", details: "<p>Bring a laptop. Lunch is included.</p>", price: 1500 },
      ] },
      pages: [
        { title: "Events", path: "/events", content: listPage("Events", "What is coming up.", "collection:events", { image: "{{ item.cover }}", eyebrow: "{{ item.startsAt | date:\"dd mmm yyyy\" }}", title: "{{ item.title }}", text: "{{ item.venue }} — {{ item.summary | truncate:90 }}", href: "{{ item.url }}", linkLabel: "Details" }, "startsAt") },
        { title: "Event", path: "/events/:slug", collectionKey: "events", content: itemPage("All events", "/events", [n("Eyebrow", { text: "{{ item.startsAt | date:\"dd mmm yyyy\" }} · {{ item.venue }}" }), n("Heading", { text: "{{ item.title }}", level: "h1" }), n("Text", { text: "{{ item.summary }}", lead: true }), n("Countdown", { date: "{{ item.startsAt }}", endText: "This event has started." }), n("Spacer", { height: 16 }), n("RichText", { html: "{{ item.details }}" }), n("Button", { label: "Add to calendar", href: "/calendar/events/{{ item.slug }}.ics", variant: "outline" }), n("Spacer", { height: 8 }), n("Button", { label: "Register", href: "{{ item.registerUrl }}" }, [], { conditions: { match: "all", rules: [{ left: "{{ item.registerUrl }}", op: "notEmpty", right: "" }] } })]) },
      ],
    }),
  },
  {
    key: "team", name: "Team", icon: "Users", description: "Team members with roles, photos and a profile page.",
    build: () => ({
      collections: [{ key: "team", name: "Team members", settings: { titleField: "name", apiEnabled: false, appKey: "team" }, fields: [f("name", "Name", "text", { required: true }), f("role", "Role"), f("photo", "Photo", "image"), f("bio", "Bio", "richtext"), f("email", "Email", "email"), f("department", "Department", "select", { options: ["Leadership", "Operations", "Support"] })] }],
      records: { team: [{ name: "Aarav Sharma", role: "Director", department: "Leadership", bio: "<p>A short bio goes here.</p>" }, { name: "Meera Iyer", role: "Operations Head", department: "Operations", bio: "<p>A short bio goes here.</p>" }, { name: "Kabir Khan", role: "Support Lead", department: "Support", bio: "<p>A short bio goes here.</p>" }] },
      pages: [
        { title: "Team", path: "/team", content: listPage("Our team", "The people behind the work.", "collection:team", { image: "{{ item.photo }}", eyebrow: "{{ item.department }}", title: "{{ item.name }}", text: "{{ item.role }}", href: "{{ item.url }}", linkLabel: "Profile" }, "name") },
        { title: "Team member", path: "/team/:slug", collectionKey: "team", content: itemPage("Whole team", "/team", [n("Eyebrow", { text: "{{ item.department }}" }), n("Heading", { text: "{{ item.name }}", level: "h1" }), n("Text", { text: "{{ item.role }}", lead: true }), n("RichText", { html: "{{ item.bio }}" })]) },
      ],
    }),
  },
  {
    key: "catalogue", name: "Catalogue", icon: "Briefcase", description: "Products or services with prices, search and a detail page. No cart or payment.",
    build: () => ({
      collections: [{ key: "products", name: "Products", settings: { titleField: "name", apiEnabled: true, appKey: "catalogue" }, fields: [f("name", "Name", "text", { required: true }), f("price", "Price", "number"), f("image", "Image", "image"), f("summary", "Summary", "textarea"), f("description", "Description", "richtext"), f("category", "Category", "select", { options: ["Popular", "New", "Classic"] }), f("inStock", "In stock", "boolean")] }],
      records: { products: [{ name: "Starter pack", price: 999, summary: "Everything you need to begin.", description: "<p>Describe what is included.</p>", category: "Popular", inStock: true }, { name: "Pro pack", price: 2499, summary: "For growing teams.", description: "<p>Describe what is included.</p>", category: "New", inStock: true }, { name: "Classic edition", price: 1499, summary: "The one people keep coming back to.", description: "<p>Describe what is included.</p>", category: "Classic", inStock: false }] },
      pages: [
        { title: "Catalogue", path: "/catalogue", content: listPage("Catalogue", "Browse what we offer.", "collection:products", { image: "{{ item.image }}", eyebrow: "{{ item.category }}", title: "{{ item.name }}", text: "{{ item.price | currency:\"INR\" }} — {{ item.summary | truncate:80 }}", href: "{{ item.url }}", linkLabel: "View" }, "price") },
        { title: "Product", path: "/catalogue/:slug", collectionKey: "products", content: itemPage("Catalogue", "/catalogue", [n("Eyebrow", { text: "{{ item.category }}" }), n("Heading", { text: "{{ item.name }}", level: "h1" }), n("Heading", { text: "{{ item.price | currency:\"INR\" }}", level: "h3" }), n("Alert", { text: "Currently out of stock." }, [], { conditions: { match: "all", rules: [{ left: "{{ item.inStock }}", op: "empty", right: "" }] } }), n("Text", { text: "{{ item.summary }}", lead: true }), n("RichText", { html: "{{ item.description }}" }), n("Form", { name: "Enquiry: {{ item.name }}", submitLabel: "Send enquiry" })]) },
      ],
    }),
  },
  {
    key: "announcements", name: "Announcements", icon: "Sparkles", description: "Notices with dates and an archive page.",
    build: () => ({
      collections: [{ key: "notices", name: "Notices", settings: { titleField: "title", apiEnabled: true, appKey: "announcements" }, fields: [f("title", "Title", "text", { required: true }), f("date", "Date", "date"), f("body", "Body", "richtext"), f("pinned", "Pinned", "boolean")] }],
      records: { notices: [{ title: "Office closed on the public holiday", date: days(5), body: "<p>We reopen the next working day.</p>", pinned: true }, { title: "New timings from next month", date: days(20), body: "<p>Please note the updated timings.</p>", pinned: false }] },
      pages: [
        { title: "Notices", path: "/notices", content: listPage("Notices", "Latest announcements.", "collection:notices", { image: "", eyebrow: "{{ item.date | date:\"dd mmm yyyy\" }}", title: "{{ item.title }}", text: "{{ item.body | stripHtml | truncate:110 }}", href: "{{ item.url }}", linkLabel: "Read" }, "-date") },
        { title: "Notice", path: "/notices/:slug", collectionKey: "notices", content: itemPage("All notices", "/notices", [n("Eyebrow", { text: "{{ item.date | date:\"dd mmm yyyy\" }}" }), n("Heading", { text: "{{ item.title }}", level: "h1" }), n("RichText", { html: "{{ item.body }}" })]) },
      ],
    }),
  },
  {
    key: "courses", name: "Courses", icon: "GraduationCap", description: "Courses or programmes with level, duration, fees and an admission form.",
    build: () => ({
      collections: [{ key: "courses", name: "Courses", settings: { titleField: "title", apiEnabled: true, appKey: "courses" }, fields: [f("title", "Title", "text", { required: true }), f("level", "Level", "select", { options: ["Beginner", "Intermediate", "Advanced"] }), f("duration", "Duration"), f("fees", "Fees", "number"), f("image", "Image", "image"), f("summary", "Summary", "textarea"), f("syllabus", "Syllabus", "richtext")] }],
      records: { courses: [{ title: "Foundation course", level: "Beginner", duration: "3 months", fees: 15000, summary: "Start from the basics.", syllabus: "<ul><li>Module 1</li><li>Module 2</li></ul>" }, { title: "Advanced programme", level: "Advanced", duration: "6 months", fees: 40000, summary: "For those ready to go further.", syllabus: "<ul><li>Module 1</li><li>Module 2</li></ul>" }] },
      pages: [
        { title: "Courses", path: "/courses", content: listPage("Courses", "Find the right programme.", "collection:courses", { image: "{{ item.image }}", eyebrow: "{{ item.level }} · {{ item.duration }}", title: "{{ item.title }}", text: "{{ item.summary | truncate:100 }}", href: "{{ item.url }}", linkLabel: "Details" }, "title") },
        { title: "Course", path: "/courses/:slug", collectionKey: "courses", content: itemPage("All courses", "/courses", [n("Eyebrow", { text: "{{ item.level }} · {{ item.duration }}" }), n("Heading", { text: "{{ item.title }}", level: "h1" }), n("Heading", { text: "Fees: {{ item.fees | currency:\"INR\" }}", level: "h4" }), n("Text", { text: "{{ item.summary }}", lead: true }), n("RichText", { html: "{{ item.syllabus }}" }), n("Form", { name: "Admission: {{ item.title }}", submitLabel: "Apply" })]) },
      ],
    }),
  },
];

export function buildAppPackage(key) {
  const app = SITE_APPS.find((a) => a.key === key);
  return app ? { key: app.key, name: app.name, ...app.build() } : null;
}
