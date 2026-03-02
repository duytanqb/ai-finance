"use client";

import { Button } from "@packages/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/ui/card";
import { Input } from "@packages/ui/components/ui/input";
import { Label } from "@packages/ui/components/ui/label";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface CredentialStatus {
  configured: boolean;
  provider?: string;
  maskedApiKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function TradingSettingsPage() {
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/credentials");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ configured: false });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      setMessage({
        type: "error",
        text: "Vui lòng nhập API Key và API Secret",
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Đã lưu thông tin DNSE" });
        setApiKey("");
        setApiSecret("");
        fetchStatus();
      } else {
        const text = await res.text();
        let errorMsg = "Lưu thất bại";
        try {
          const data = JSON.parse(text);
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = `HTTP ${res.status}: ${text.slice(0, 200)}`;
        }
        setMessage({ type: "error", text: errorMsg });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi kết nối",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/credentials/test", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Kết nối DNSE thành công!" });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Kết nối thất bại",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối" });
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Đã xóa thông tin DNSE" });
        fetchStatus();
      }
    } catch {
      setMessage({ type: "error", text: "Xóa thất bại" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>DNSE Trading</CardTitle>
          <CardDescription>
            Kết nối tài khoản DNSE Lightspeed để giao dịch và nhận dữ liệu
            real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status?.configured && (
            <div className="flex items-center gap-2 rounded-md border-3 border-green-600 bg-green-50 px-4 py-3 dark:bg-green-950/30">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <div className="min-w-0">
                <p className="font-bold text-sm text-green-800 dark:text-green-400">
                  Đã kết nối DNSE
                </p>
                {status.maskedApiKey && (
                  <p className="text-xs font-mono text-green-700 dark:text-green-500">
                    API Key: {status.maskedApiKey}
                  </p>
                )}
                {status.updatedAt && (
                  <p className="text-xs text-green-700 dark:text-green-500">
                    Cập nhật:{" "}
                    {new Date(status.updatedAt).toLocaleDateString("vi-VN")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dnse-api-key" className="font-bold">
                API Key
              </Label>
              <Input
                id="dnse-api-key"
                placeholder="Nhập API Key DNSE"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="border-3 font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dnse-api-secret" className="font-bold">
                API Secret
              </Label>
              <div className="relative">
                <Input
                  id="dnse-api-secret"
                  type={showSecret ? "text" : "password"}
                  placeholder="Nhập API Secret DNSE"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="border-3 pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`rounded-md border-3 px-4 py-3 text-sm font-bold ${
                message.type === "success"
                  ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-400"
                  : "border-red-600 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSave}
              disabled={saving || !apiKey || !apiSecret}
              className="border-3 border-black bg-black font-bold text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-black/90 dark:border-white dark:bg-white dark:text-black dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>

            {status?.configured && (
              <>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                  className="border-3 font-bold"
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="mr-2 h-4 w-4" />
                  )}
                  Test kết nối
                </Button>

                <Button
                  variant="outline"
                  onClick={handleRemove}
                  disabled={removing}
                  className="border-3 font-bold text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                >
                  {removing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Xóa
                </Button>
              </>
            )}
          </div>

          <div className="border-t-3 pt-4">
            <p className="text-xs text-muted-foreground">
              API Key và Secret được lưu an toàn trong Supabase. Dùng để xác
              thực với DNSE OpenAPI.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
