import { useState, useEffect, useCallback } from "react";
import { supabase, ContentApproval } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

async function verifyPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/verify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: ContentApproval["status"] }) {
  const map = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-blue-100 text-blue-800 border-blue-200",
    posted: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status]}`}>
      {status}
    </span>
  );
}

function ContentCard({
  item,
  onApprove,
  onReject,
  onEdit,
}: {
  item: ContentApproval;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);

  const handleSave = () => {
    onEdit(item.id, draft);
    setEditing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          {item.recipient && (
            <span className="text-xs text-gray-500 font-medium">To: {item.recipient}</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{timeAgo(item.created_at)}</span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="text-sm resize-none font-mono"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="bg-gray-900 text-white hover:bg-gray-700">
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(item.content); setEditing(false); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.content}</p>
      )}

      {item.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onApprove(item.id)}
            className="bg-green-600 hover:bg-green-700 text-white flex-1"
          >
            Approve &amp; Post
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="flex-1"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(item.id)}
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
          >
            Reject
          </Button>
        </div>
      )}

      {item.status === "approved" && (
        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium pt-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
          Queued - posting shortly
        </div>
      )}

      {item.status === "posted" && item.posted_at && (
        <div className="text-xs text-green-600 font-medium pt-1">
          Posted {timeAgo(item.posted_at)}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [checking, setChecking] = useState(false);
  const [items, setItems] = useState<ContentApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setItems(data as ContentApproval[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authed) return;
    load();
    const channel = supabase
      .channel("content_approvals_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_approvals" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authed, load]);

  const updateStatus = async (id: string, status: ContentApproval["status"], extra?: Partial<ContentApproval>) => {
    const { error } = await supabase
      .from("content_approvals")
      .update({ status, ...extra })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      load();
    }
  };

  const handleApprove = (id: string) => updateStatus(id, "approved");
  const handleReject = (id: string) => updateStatus(id, "rejected");
  const handleEdit = async (id: string, content: string) => {
    const { error } = await supabase.from("content_approvals").update({ content }).eq("id", id);
    if (!error) { load(); toast({ title: "Saved" }); }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-sm shadow-sm flex flex-col gap-4">
          <div>
            <img src="/Markety.png" alt="Markety" className="h-7 w-auto mb-6" />
            <h1 className="text-xl font-semibold text-gray-900">Admin access</h1>
            <p className="text-sm text-gray-500 mt-1">Enter password to continue</p>
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== "Enter" || checking) return;
              setChecking(true);
              const ok = await verifyPassword(pw);
              setChecking(false);
              if (ok) setAuthed(true);
              else toast({ title: "Wrong password", variant: "destructive" });
            }}
            placeholder="Password"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
          />
          <Button
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              const ok = await verifyPassword(pw);
              setChecking(false);
              if (ok) setAuthed(true);
              else toast({ title: "Wrong password", variant: "destructive" });
            }}
            className="bg-gray-900 hover:bg-gray-700 text-white"
          >
            {checking ? "Checking..." : "Enter"}
          </Button>
        </div>
      </div>
    );
  }

  const byType = (type: ContentApproval["type"]) => items.filter((i) => i.type === type);
  const pending = items.filter((i) => i.status === "pending");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/Markety.png" alt="Markety" className="h-7 w-auto" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Content approvals</h1>
              <p className="text-xs text-gray-500 mt-0.5">Review before publishing</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pending.length > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-yellow-200">
                {pending.length} pending
              </span>
            )}
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="linkedin_post">
          <TabsList className="mb-6 bg-white border border-gray-200">
            <TabsTrigger value="linkedin_post" className="gap-2">
              LinkedIn Posts
              {byType("linkedin_post").filter((i) => i.status === "pending").length > 0 && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                  {byType("linkedin_post").filter((i) => i.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="linkedin_dm" className="gap-2">
              LinkedIn DMs
              {byType("linkedin_dm").filter((i) => i.status === "pending").length > 0 && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                  {byType("linkedin_dm").filter((i) => i.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              Emails
              {byType("email").filter((i) => i.status === "pending").length > 0 && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                  {byType("email").filter((i) => i.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {(["linkedin_post", "linkedin_dm", "email"] as const).map((type) => (
            <TabsContent key={type} value={type}>
              {byType(type).length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-sm">Nothing here yet</p>
                  <p className="text-xs mt-1">Content queued for approval will appear here</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {byType(type).map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
