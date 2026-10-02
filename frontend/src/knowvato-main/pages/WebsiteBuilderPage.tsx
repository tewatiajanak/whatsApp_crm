import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Globe2,
  Plus,
  Search,
  Eye,
  Edit,
  Copy,
  ExternalLink,
  Trash2,
  FileText,
  FormInput,
  BarChart2,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Wand2,
  LayoutTemplate,
  Sparkles,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

// Import existing visual builders from the project
import LandingPageBuilder from "../../components/LandingPageBuilder";
import LandingPageWizard from "../../components/LandingPageWizard";
import RegistrationFormBuilder from "../../components/RegistrationFormBuilder";

interface WebPageItem {
  id: string;
  title: string;
  slug: string;
  type: "Landing Page" | "Enquiry Form" | "Event Page" | "Registration";
  views: number;
  submissions: number;
  conversion: string;
  status: "Published" | "Draft";
  updatedAt: string;
}

const INITIAL_PAGES: WebPageItem[] = [
  {
    id: "page-1",
    title: "Summer Admissions Gala 2026",
    slug: "/clp/enquirenow",
    type: "Landing Page",
    views: 4820,
    submissions: 342,
    conversion: "7.1%",
    status: "Published",
    updatedAt: "2026-07-24 14:30",
  },
  {
    id: "page-2",
    title: "Greenwood College Main Enquiry Form",
    slug: "/public/enquiry-form/ef-101",
    type: "Enquiry Form",
    views: 8930,
    submissions: 1204,
    conversion: "13.4%",
    status: "Published",
    updatedAt: "2026-07-22 10:15",
  },
  {
    id: "page-3",
    title: "Annual Tech Mixer Registration",
    slug: "/public/landing-page/lp-902",
    type: "Event Page",
    views: 1940,
    submissions: 285,
    conversion: "14.6%",
    status: "Published",
    updatedAt: "2026-07-20 18:45",
  },
  {
    id: "page-4",
    title: "Executive MBA Open Day - Fall Draft",
    slug: "/public/landing-page/emba-2026",
    type: "Landing Page",
    views: 0,
    submissions: 0,
    conversion: "0.0%",
    status: "Draft",
    updatedAt: "2026-07-19 11:20",
  },
];

export default function WebsiteBuilderPage() {
  const [activeTab, setActiveTab] = useState<"pages" | "builder" | "wizard" | "forms">("pages");
  const [pages, setPages] = useState<WebPageItem[]>(INITIAL_PAGES);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedPageForEdit, setSelectedPageForEdit] = useState<any>(null);

  const url = "/modules/website";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const filteredPages = pages.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
    const matchesType =
      selectedType === "all" || p.type.toLowerCase().replace(" ", "-") === selectedType;
    return matchesSearch && matchesType;
  });

  const handleCopyLink = (slug: string) => {
    const fullUrl = `${window.location.origin}${slug}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Page URL copied to clipboard!");
  };

  const handleToggleStatus = (id: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === "Published" ? "Draft" : "Published" } : p
      )
    );
    toast.success("Page status updated!");
  };

  const handleDeletePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    toast.success("Page removed successfully.");
  };

  const handleOpenVisualBuilder = (page?: WebPageItem) => {
    setSelectedPageForEdit(
      page
        ? { _id: page.id, name: page.title, pageType: page.type.toLowerCase() }
        : { _id: `page-${Date.now()}`, name: "New Visual Landing Page" }
    );
    setActiveTab("builder");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 text-decoration-none mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Website & Visual Page Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "Website Builder", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button asChild variant="outline">
            <Link to="/modules/website/setup" className="text-decoration-none">
              <SlidersHorizontal className="h-4 w-4 mr-1" /> Setup
            </Link>
          </Button>
          <Button onClick={() => handleOpenVisualBuilder()} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" /> Visual Page Builder
          </Button>
        </div>
      </div>

      {/* Primary Builder Tabs Bar */}
      <div className="flex items-center gap-2 border-b pb-3 overflow-x-auto">
        <Button
          variant={activeTab === "pages" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("pages")}
          className="gap-2"
        >
          <Globe2 className="h-4 w-4" /> Published Pages & Directory
        </Button>

        <Button
          variant={activeTab === "builder" ? "default" : "ghost"}
          size="sm"
          onClick={() => handleOpenVisualBuilder()}
          className="gap-2"
        >
          <LayoutTemplate className="h-4 w-4" /> Visual Drag & Drop Builder
        </Button>

        <Button
          variant={activeTab === "wizard" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("wizard")}
          className="gap-2"
        >
          <Wand2 className="h-4 w-4" /> Landing Page Wizard
        </Button>

        <Button
          variant={activeTab === "forms" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("forms")}
          className="gap-2"
        >
          <FormInput className="h-4 w-4" /> Registration & Form Designer
        </Button>
      </div>

      {/* Tab 1: Pages Directory & KPIs */}
      {activeTab === "pages" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Published Pages</CardTitle>
                <Globe2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{pages.filter((p) => p.status === "Published").length}</div>
                <p className="text-xs text-emerald-600 mt-1">✓ Live on custom domain</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Page Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {pages.reduce((acc, p) => acc + p.views, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">+18.4% vs last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Form Submissions</CardTitle>
                <FormInput className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {pages.reduce((acc, p) => acc + p.submissions, 0).toLocaleString()}
                </div>
                <p className="text-xs text-emerald-600 mt-1">Directly synced to CRM</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Conversion Rate</CardTitle>
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-600">11.7%</div>
                <p className="text-xs text-muted-foreground mt-1">Top performer: Enquiry Form</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search page by title or URL..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                <Button
                  variant={selectedType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("all")}
                >
                  All Types
                </Button>
                <Button
                  variant={selectedType === "landing-page" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("landing-page")}
                >
                  Landing Pages
                </Button>
                <Button
                  variant={selectedType === "enquiry-form" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("enquiry-form")}
                >
                  Enquiry Forms
                </Button>
                <Button
                  variant={selectedType === "event-page" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("event-page")}
                >
                  Event Pages
                </Button>
              </div>
            </div>
          </Card>

          {/* Pages Directory Table */}
          <Card>
            <CardHeader className="py-4 px-6 border-b">
              <CardTitle className="text-base font-semibold">Active Website Pages & Portals</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="px-6 py-3">Page Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Views</th>
                      <th className="px-4 py-3">Submissions</th>
                      <th className="px-4 py-3">Conv. %</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Updated</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPages.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground">
                          No website pages found.
                        </td>
                      </tr>
                    ) : (
                      filteredPages.map((page) => (
                        <tr key={page.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-foreground">
                            <div>{page.title}</div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{page.slug}</div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="outline" className="font-normal">
                              {page.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">{page.views.toLocaleString()}</td>
                          <td className="px-4 py-4 font-semibold">{page.submissions.toLocaleString()}</td>
                          <td className="px-4 py-4 text-emerald-600 font-medium">{page.conversion}</td>
                          <td className="px-4 py-4">
                            <Badge
                              variant={page.status === "Published" ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => handleToggleStatus(page.id)}
                            >
                              {page.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">{page.updatedAt}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link to={page.slug} target="_blank" className="text-decoration-none">
                                <Button size="icon" variant="ghost" className="h-8 w-8" title="Preview Public Page">
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </Link>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Copy Public Link"
                                onClick={() => handleCopyLink(page.slug)}
                              >
                                <Copy className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Edit in Visual Builder"
                                onClick={() => handleOpenVisualBuilder(page)}
                              >
                                <Edit className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                title="Delete Page"
                                onClick={() => handleDeletePage(page.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Visual Drag & Drop Landing Page Builder */}
      {activeTab === "builder" && (
        <Card className="p-2 border rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 border-b flex items-center justify-between bg-muted/20">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visual Canvas Builder Mode
            </span>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("pages")}>
              Exit Builder
            </Button>
          </div>
          <LandingPageBuilder
            initialPage={selectedPageForEdit}
            formsList={[]}
            onSave={() => {
              toast.success("Landing page saved!");
              setActiveTab("pages");
            }}
            onCancel={() => setActiveTab("pages")}
          />
        </Card>
      )}

      {/* Tab 3: Step-by-Step Landing Page Wizard */}
      {activeTab === "wizard" && (
        <Card className="p-4 border rounded-xl shadow-xs">
          <div className="p-3 border-b flex items-center justify-between mb-4 bg-muted/20 rounded-lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Landing Page Guided Wizard
            </span>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("pages")}>
              Exit Wizard
            </Button>
          </div>
          <LandingPageWizard
            onComplete={() => {
              toast.success("Page generated via Wizard!");
              setActiveTab("pages");
            }}
            onCancel={() => setActiveTab("pages")}
          />
        </Card>
      )}

      {/* Tab 4: Registration & Form Designer */}
      {activeTab === "forms" && (
        <Card className="p-4 border rounded-xl shadow-xs">
          <div className="p-3 border-b flex items-center justify-between mb-4 bg-muted/20 rounded-lg">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Registration Form Designer
            </span>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("pages")}>
              Exit Form Designer
            </Button>
          </div>
          <RegistrationFormBuilder
            onSave={() => {
              toast.success("Form design saved!");
              setActiveTab("pages");
            }}
          />
        </Card>
      )}
    </div>
  );
}
