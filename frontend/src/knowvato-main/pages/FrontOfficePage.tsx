import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  UserCheck,
  LogOut,
  Clock,
  Printer,
  Search,
  Plus,
  QrCode,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

interface VisitorEntry {
  id: string;
  name: string;
  phone: string;
  type: "Parent" | "Vendor" | "Guest" | "Auditor";
  host: string;
  checkIn: string;
  checkOut?: string;
  badgeId: string;
  status: "Checked In" | "Checked Out" | "Scheduled";
}

const INITIAL_VISITORS: VisitorEntry[] = [
  {
    id: "vis-1",
    name: "Vikram Malhotra",
    phone: "+91 98765 43210",
    type: "Parent",
    host: "Priya Kothari (Admissions)",
    checkIn: "10:15 AM",
    badgeId: "PASS-8801",
    status: "Checked In",
  },
  {
    id: "vis-2",
    name: "Sunita Roy",
    phone: "+91 91234 56789",
    type: "Vendor",
    host: "Aman Sharma (Ops)",
    checkIn: "09:30 AM",
    checkOut: "11:00 AM",
    badgeId: "PASS-8802",
    status: "Checked Out",
  },
  {
    id: "vis-3",
    name: "Rajeev Mehta",
    phone: "+91 99887 76655",
    type: "Guest",
    host: "Principal Office",
    checkIn: "11:45 AM",
    badgeId: "PASS-8803",
    status: "Checked In",
  },
  {
    id: "vis-4",
    name: "Dr. K. N. Rao",
    phone: "+91 94433 22110",
    type: "Auditor",
    host: "Academic Council",
    checkIn: "2:00 PM (Scheduled)",
    badgeId: "PASS-8804",
    status: "Scheduled",
  },
];

// Shared between the Today / Upcoming views so switching menus keeps the
// session's check-ins (data is local sample data — no backend yet).
let visitorStore: VisitorEntry[] = INITIAL_VISITORS;

type View = "today" | "upcoming";

const VIEW_META: Record<View, { title: string; description: string; cta: string }> = {
  today: {
    title: "Today Visitors",
    description: "Visitors on campus today — check-in/out and guest badge issuance.",
    cta: "Check In Visitor",
  },
  upcoming: {
    title: "Upcoming Visitors",
    description: "Scheduled appointments and expected visitors.",
    cta: "Schedule Visit",
  },
};

export default function FrontOfficePage({ view = "today" }: { view?: View }) {
  const meta = VIEW_META[view];
  const [visitors, setVisitorsState] = useState<VisitorEntry[]>(visitorStore);
  const setVisitors = (update: (prev: VisitorEntry[]) => VisitorEntry[]) =>
    setVisitorsState((prev) => {
      visitorStore = update(prev);
      return visitorStore;
    });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);

  const [formState, setFormState] = useState({
    name: "",
    phone: "+91 ",
    type: "Parent" as VisitorEntry["type"],
    host: "Priya Kothari (Admissions)",
  });

  const url = `/modules/front-office/visitors/${view}`;
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const viewVisitors = visitors.filter((v) => (view === "upcoming" ? v.status === "Scheduled" : v.status !== "Scheduled"));
  const filteredVisitors = viewVisitors.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.phone.toLowerCase().includes(search.toLowerCase()) ||
      v.badgeId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCheckOut = (id: string) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setVisitors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: "Checked Out", checkOut: nowTime } : v))
    );
    toast.success("Visitor checked out!");
  };

  const handlePrintBadge = (badgeId: string) => {
    toast.success(`Printing Visitor Pass ${badgeId}...`);
  };

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || formState.phone.length < 5) {
      toast.error("Please enter visitor name and phone number.");
      return;
    }

    const newVisitor: VisitorEntry = {
      id: `vis-${Date.now()}`,
      name: formState.name,
      phone: formState.phone,
      type: formState.type,
      host: formState.host,
      checkIn:
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + (view === "upcoming" ? " (Scheduled)" : ""),
      badgeId: `PASS-${Math.floor(1000 + Math.random() * 9000)}`,
      status: view === "upcoming" ? "Scheduled" : "Checked In",
    };

    setVisitors((prev) => [newVisitor, ...prev]);
    toast.success(
      view === "upcoming"
        ? `Visit scheduled for ${formState.name}.`
        : `Visitor ${formState.name} checked in! Pass ${newVisitor.badgeId} generated.`
    );
    setIsCheckInOpen(false);
    setFormState({ name: "", phone: "+91 ", type: "Parent", host: "Priya Kothari (Admissions)" });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 text-decoration-none mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "Front Office", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button onClick={() => setIsCheckInOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" /> {meta.cta}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Currently Checked In</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {visitors.filter((v) => v.status === "Checked In").length}
            </div>
            <p className="text-xs text-emerald-600 mt-1">✓ Active on campus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Total Visitors</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{visitors.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Parents, Vendors & Guests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Badges Issued</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{visitors.length}</div>
            <p className="text-xs text-emerald-600 mt-1">QR Pass badge generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled Appointments</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {visitors.filter((v) => v.status === "Scheduled").length}
            </div>
            <p className="text-xs text-amber-600 mt-1">Expected today</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Actions Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by visitor name, phone, or badge ID..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {view === "today" && (
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All Visitors
            </Button>
            <Button
              variant={statusFilter === "Checked In" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("Checked In")}
            >
              Checked In
            </Button>
            <Button
              variant={statusFilter === "Checked Out" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("Checked Out")}
            >
              Checked Out
            </Button>
          </div>
          )}
        </div>
      </Card>

      {/* Visitors Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <CardTitle className="text-base font-semibold">Visitor Terminal Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-3">Visitor Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Host / Staff</th>
                  <th className="px-4 py-3">Badge ID</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Check-Out</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVisitors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No visitor records found.
                    </td>
                  </tr>
                ) : (
                  filteredVisitors.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{v.name}</div>
                        <div className="text-xs text-muted-foreground">{v.phone}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="font-normal">
                          {v.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium">{v.host}</td>
                      <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{v.badgeId}</td>
                      <td className="px-4 py-4 text-xs">{v.checkIn}</td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{v.checkOut || "—"}</td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            v.status === "Checked In"
                              ? "default"
                              : v.status === "Checked Out"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {v.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {v.status === "Checked In" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCheckOut(v.id)}
                              className="text-xs h-7"
                            >
                              <LogOut className="h-3 w-3 mr-1" /> Check Out
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Print Badge Pass"
                            onClick={() => handlePrintBadge(v.badgeId)}
                          >
                            <Printer className="h-4 w-4 text-muted-foreground" />
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

      {/* Visitor Check In Modal */}
      {isCheckInOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-base">{view === "upcoming" ? "Schedule Visit" : "New Visitor Check-In"}</h3>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsCheckInOpen(false)}>
                ✕
              </Button>
            </div>

            <form onSubmit={handleCheckInSubmit} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Visitor Name
                </label>
                <Input
                  placeholder="e.g. Ramesh Patel"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Phone Number
                </label>
                <Input
                  placeholder="+91 98765 43210"
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Visitor Category
                  </label>
                  <select
                    className="w-full h-9 border rounded-md px-3 text-sm bg-background border-input"
                    value={formState.type}
                    onChange={(e) =>
                      setFormState({ ...formState, type: e.target.value as VisitorEntry["type"] })
                    }
                  >
                    <option value="Parent">Parent</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Guest">Guest</option>
                    <option value="Auditor">Auditor</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Host Staff Member
                  </label>
                  <Input
                    placeholder="e.g. Priya Kothari"
                    value={formState.host}
                    onChange={(e) => setFormState({ ...formState, host: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCheckInOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground">
                  {view === "upcoming" ? "Schedule Visit" : "Check In & Issue Badge"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
