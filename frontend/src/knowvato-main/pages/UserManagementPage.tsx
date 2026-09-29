import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserPlus,
  Shield,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Key,
  Mail,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Edit2,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/lib/bookmarks";
import { toast } from "sonner";

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "Administrator" | "Sales Manager" | "Counsellor" | "Receptionist" | "Viewer";
  department: string;
  status: "Active" | "Suspended" | "Invited";
  lastActive: string;
}

const INITIAL_USERS: SystemUser[] = [
  {
    id: "u-1",
    name: "Priya Kothari",
    email: "priya@greenwood.edu",
    role: "Administrator",
    department: "Admissions & Admin",
    status: "Active",
    lastActive: "Just now",
  },
  {
    id: "u-2",
    name: "Aman Sharma",
    email: "aman@greenwood.edu",
    role: "Sales Manager",
    department: "CRM Operations",
    status: "Active",
    lastActive: "14m ago",
  },
  {
    id: "u-3",
    name: "Ananya Roy",
    email: "ananya@greenwood.edu",
    role: "Counsellor",
    department: "Student Admissions",
    status: "Active",
    lastActive: "2h ago",
  },
  {
    id: "u-4",
    name: "Rohan Verma",
    email: "rohan@greenwood.edu",
    role: "Receptionist",
    department: "Front Office",
    status: "Active",
    lastActive: "Yesterday",
  },
  {
    id: "u-5",
    name: "Siddharth Jain",
    email: "siddharth@greenwood.edu",
    role: "Viewer",
    department: "Management",
    status: "Invited",
    lastActive: "Pending Invite",
  },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_USERS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "Counsellor" as SystemUser["role"],
    department: "Student Admissions",
  });

  const url = "/modules/users";
  const { add, remove, has } = useBookmarks();
  const pinned = has(url);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleToggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextStatus = u.status === "Active" ? "Suspended" : "Active";
          toast.success(`User status changed to ${nextStatus}`);
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const handleDeleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    toast.success("User account removed.");
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) {
      toast.error("Please fill in required fields.");
      return;
    }

    const newUser: SystemUser = {
      id: `u-${Date.now()}`,
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role,
      department: inviteForm.department,
      status: "Invited",
      lastActive: "Pending Invite",
    };

    setUsers((prev) => [newUser, ...prev]);
    toast.success(`Invitation email sent to ${inviteForm.email}`);
    setIsInviteModalOpen(false);
    setInviteForm({ name: "", email: "", role: "Counsellor", department: "Student Admissions" });
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
          <h1 className="text-2xl font-semibold tracking-tight">User Management & Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Manage organization members, assign role-based permissions and monitor access logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={pinned ? "secondary" : "outline"}
            onClick={() => (pinned ? remove(url) : add({ title: "User Management", url }))}
          >
            {pinned ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
            {pinned ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button onClick={() => setIsInviteModalOpen(true)} className="bg-primary text-primary-foreground">
            <UserPlus className="h-4 w-4" /> Invite Team Member
          </Button>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user by name or email..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <Button
              variant={roleFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("all")}
            >
              All Roles
            </Button>
            <Button
              variant={roleFilter === "Administrator" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("Administrator")}
            >
              Admins
            </Button>
            <Button
              variant={roleFilter === "Sales Manager" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("Sales Manager")}
            >
              Managers
            </Button>
            <Button
              variant={roleFilter === "Counsellor" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("Counsellor")}
            >
              Counsellors
            </Button>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b">
          <CardTitle className="text-base font-semibold">Workspace Team Members</CardTitle>
          <CardDescription className="text-xs">
            Review user roles, departments, and active statuses across your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-6 py-3">Member Name</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3">Last Active</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No team members found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((userItem) => (
                    <tr key={userItem.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center font-semibold text-xs text-accent-foreground">
                            {userItem.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{userItem.name}</div>
                            <div className="text-xs text-muted-foreground">{userItem.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={userItem.role === "Administrator" ? "default" : "outline"}
                          className="font-normal"
                        >
                          {userItem.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{userItem.department}</td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            userItem.status === "Active"
                              ? "default"
                              : userItem.status === "Invited"
                              ? "secondary"
                              : "destructive"
                          }
                          className="cursor-pointer"
                          onClick={() => handleToggleStatus(userItem.id)}
                        >
                          {userItem.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">{userItem.lastActive}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Toggle Status (Active/Suspended)"
                            onClick={() => handleToggleStatus(userItem.id)}
                          >
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="Remove User"
                            onClick={() => handleDeleteUser(userItem.id)}
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

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-base">Invite Team Member</h3>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsInviteModalOpen(false)}>
                ✕
              </Button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="rahul@greenwood.edu"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    System Role
                  </label>
                  <select
                    className="w-full h-9 border rounded-md px-3 text-sm bg-background border-input"
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role: e.target.value as SystemUser["role"] })
                    }
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="Sales Manager">Sales Manager</option>
                    <option value="Counsellor">Counsellor</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Department
                  </label>
                  <Input
                    placeholder="e.g. Admissions"
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground">
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
